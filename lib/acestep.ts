import type { FusionPayload } from './fusion'

// RunPod Serverless. El contrato de ACE-Step (release_task / query_result /
// v1/audio) ahora vive dentro del worker — ver runpod-worker/handler.py.
// Desde aquí solo hablamos con la cola de RunPod.
const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID || ''
const API_KEY = process.env.RUNPOD_API_KEY || ''
const BASE_URL = `https://api.runpod.ai/v2/${ENDPOINT_ID}`

export interface GenerationResult {
  taskId: string
  audioUrl: string | null
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  }
}

function assertConfigured() {
  if (!ENDPOINT_ID || !API_KEY) {
    throw new Error(
      'Falta configurar RUNPOD_ENDPOINT_ID y RUNPOD_API_KEY en las variables de entorno.'
    )
  }
}

export async function releaseTask(payload: FusionPayload): Promise<string> {
  assertConfigured()

  const res = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: authHeaders(),
    // ttl de 1 hora: el resultado no debe expirar mientras hacemos polling
    body: JSON.stringify({ input: payload, policy: { ttl: 3600000 } }),
  })

  if (!res.ok) {
    throw new Error(`RunPod rechazó la petición (${res.status}): ${await res.text()}`)
  }

  const data = await res.json()
  if (!data.id) {
    throw new Error(`RunPod no devolvió un job id: ${JSON.stringify(data)}`)
  }

  return data.id
}

// Rendirse sin cancelar deja el job corriendo: sigue consumiendo GPU por un
// resultado que nadie va a recoger, y el siguiente intento se encola detrás.
// Eso convertía un timeout aislado en una cola que ya nunca se vaciaba.
async function cancelJob(jobId: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/cancel/${jobId}`, {
      method: 'POST',
      headers: authHeaders(),
    })
  } catch {
    // Best effort: si no se puede cancelar, el error del timeout manda igual.
  }
}

export async function waitForResult(
  jobId: string,
  onProgress?: (msg: string) => void,
  maxWait = 280000
): Promise<Buffer> {
  assertConfigured()

  const start = Date.now()
  const interval = 3000

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, interval))
    const elapsed = Math.round((Date.now() - start) / 1000)

    let data: any
    try {
      const res = await fetch(`${BASE_URL}/status/${jobId}`, { headers: authHeaders() })
      if (!res.ok) {
        onProgress?.(`Reintentando... ${elapsed}s`)
        continue
      }
      data = await res.json()
    } catch {
      // Error de red transitorio: seguir intentando.
      onProgress?.(`Reintentando... ${elapsed}s`)
      continue
    }

    // Fuera del try: los fallos reales deben propagarse, no reintentarse.
    switch (data.status) {
      case 'COMPLETED': {
        const output = data.output
        if (!output) throw new Error('El worker terminó sin devolver nada.')
        if (output.error) throw new Error(output.error)
        if (!output.audio_base64) {
          throw new Error(`La respuesta no traía audio: ${JSON.stringify(output).slice(0, 200)}`)
        }
        onProgress?.('¡Canción lista!')
        return Buffer.from(output.audio_base64, 'base64')
      }

      case 'FAILED':
        throw new Error(data.error || 'La generación falló en el worker.')

      case 'CANCELLED':
        throw new Error('La generación fue cancelada.')

      case 'TIMED_OUT':
        throw new Error('El worker excedió su tiempo límite.')

      case 'IN_QUEUE':
        // Cold start: RunPod está levantando un worker.
        onProgress?.(`En cola... ${elapsed}s`)
        break

      default:
        onProgress?.(`Generando... ${elapsed}s`)
    }
  }

  await cancelJob(jobId)
  throw new Error('Timeout: la generación tardó demasiado. Intenta de nuevo en unos minutos.')
}
