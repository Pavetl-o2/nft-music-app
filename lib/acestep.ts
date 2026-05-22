import type { FusionPayload } from './fusion'

const BASE_URL = process.env.ACESTEP_BASE_URL || ''
const AUDIO_CACHE_PATH = '/workspace/ACE-Step-1.5/.cache/acestep/tmp/api_audio'

export interface GenerationResult {
  taskId: string
  audioUrl: string | null
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
}

export async function releaseTask(payload: FusionPayload): Promise<string> {
  const res = await fetch(`${BASE_URL}/release_task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`ACE-Step error: ${res.status}`)
  const data = await res.json()
  return data.data.task_id
}

async function queryResult(taskId: string): Promise<Buffer | null> {
  const res = await fetch(`${BASE_URL}/query_result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // El API espera "task_id_list" (lista), no "task_id"
    body: JSON.stringify({ task_id_list: [taskId] }),
  })

  if (!res.ok) throw new Error(`Poll error: ${res.status}`)
  const data = await res.json()

  const items: any[] = Array.isArray(data.data) ? data.data : []
  if (items.length === 0) return null

  const first = items[0]
  // status 1 = succeeded, 0 = processing, 2 = failed
  if (first.status !== 1) return null

  // "result" es un string JSON que contiene el array de resultados
  let resultItems: any[] = []
  try { resultItems = JSON.parse(first.result) } catch { return null }
  if (!Array.isArray(resultItems) || resultItems.length === 0) return null

  // el path del archivo está en el campo "file"
  const audioPath: string = resultItems[0]?.file
  if (!audioPath) return null

  // el campo "file" puede ser ya una URL del endpoint (/v1/audio?path=...)
  // o un filesystem path (/workspace/...) — manejar ambos casos
  const audioFetchUrl = audioPath.startsWith('/v1/') || audioPath.startsWith('/api/')
    ? `${BASE_URL}${audioPath}`
    : `${BASE_URL}/v1/audio?path=${audioPath}`

  const audioRes = await fetch(audioFetchUrl)
  if (!audioRes.ok) return null
  return Buffer.from(await audioRes.arrayBuffer())
}

export async function waitForResult(
  taskId: string,
  onProgress?: (msg: string) => void,
  maxWait = 280000
): Promise<Buffer> {
  const start = Date.now()
  const interval = 3000

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, interval))
    const elapsed = Math.round((Date.now() - start) / 1000)

    try {
      const buf = await queryResult(taskId)
      if (buf) {
        onProgress?.('¡Canción lista!')
        return buf
      }
    } catch {
      // error transitorio, seguir intentando
    }

    onProgress?.(`Generando... ${elapsed}s`)
  }

  throw new Error('Timeout: la generación tardó demasiado. Intenta de nuevo en unos minutos.')
}
