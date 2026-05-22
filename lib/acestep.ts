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
    body: JSON.stringify({ task_id: taskId }),
  })

  if (!res.ok) throw new Error(`Poll error: ${res.status}`)
  const data = await res.json()

  const items: any[] = Array.isArray(data.data) ? data.data : []
  if (items.length === 0) return null

  const first = items[0]
  const audioPath: string | undefined = first?.audio_url || first?.url || first?.path
  if (!audioPath) return null

  const audioUrl = audioPath.startsWith('http') ? audioPath : `${BASE_URL}${audioPath}`
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) return null
  return Buffer.from(await audioRes.arrayBuffer())
}

async function fetchAudioFallback(taskId: string): Promise<Buffer | null> {
  const path = `${AUDIO_CACHE_PATH}/${taskId}.wav`
  try {
    const res = await fetch(`${BASE_URL}/v1/audio?path=${path}`)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // WAV header mínimo es 44 bytes; rechazar respuestas vacías o truncadas
    return buf.length > 44 ? buf : null
  } catch {
    return null
  }
}

export async function waitForResult(
  taskId: string,
  onProgress?: (msg: string) => void,
  maxWait = 280000
): Promise<Buffer> {
  const start = Date.now()
  const interval = 3000
  let emptyCount = 0

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, interval))
    const elapsed = Math.round((Date.now() - start) / 1000)

    try {
      const buf = await queryResult(taskId)
      if (buf) {
        onProgress?.('¡Canción lista!')
        return buf
      }
      emptyCount++
    } catch {
      // error transitorio, seguir intentando
    }

    // Fallback: después de 3 respuestas vacías y al menos 15s, intentar /v1/audio
    if (emptyCount >= 3 && elapsed >= 15) {
      const fallback = await fetchAudioFallback(taskId)
      if (fallback) {
        onProgress?.('¡Canción lista!')
        return fallback
      }
    }

    onProgress?.(`Generando... ${elapsed}s`)
  }

  throw new Error('Timeout: la generación tardó demasiado. Intenta de nuevo en unos minutos.')
}
