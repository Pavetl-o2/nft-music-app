import type { FusionPayload } from './fusion'

const BASE_URL = process.env.ACESTEP_BASE_URL || ''

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

export async function pollResult(taskId: string): Promise<{
  status: number
  audioUrls: string[]
}> {
  const res = await fetch(`${BASE_URL}/query_result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId }),
  })

  if (!res.ok) throw new Error(`Poll error: ${res.status}`)
  const data = await res.json()

  const audioUrls: string[] = []
  if (data.data?.audio_files) {
    for (const f of data.data.audio_files) {
      if (f.url) audioUrls.push(`${BASE_URL}${f.url}`)
    }
  }

  return {
    status: data.data?.status ?? 0,
    audioUrls,
  }
}

export async function waitForResult(
  taskId: string,
  onProgress?: (msg: string) => void,
  maxWait = 300000
): Promise<string[]> {
  const start = Date.now()
  const interval = 3000

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, interval))

    const { status, audioUrls } = await pollResult(taskId)

    if (status === 1) {
      onProgress?.('¡Canción lista!')
      return audioUrls
    }

    if (status === 2) {
      throw new Error('La generación falló en el servidor')
    }

    const elapsed = Math.round((Date.now() - start) / 1000)
    onProgress?.(`Generando... ${elapsed}s`)
  }

  throw new Error('Timeout: la generación tardó demasiado')
}
