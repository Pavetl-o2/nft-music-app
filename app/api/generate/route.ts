import { NextRequest, NextResponse } from 'next/server'
import { generateLyrics } from '@/lib/lyrics'
import { fuseCharacters } from '@/lib/fusion'
import { releaseTask, waitForResult } from '@/lib/acestep'
import type { Character } from '@/lib/supabase'

export const maxDuration = 300 // 5 minutes (Vercel limit)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rhythm, melody, vocals } = body as {
      rhythm: Character
      melody: Character
      vocals: Character
    }

    if (!rhythm || !melody || !vocals) {
      return NextResponse.json({ error: 'Faltan personajes' }, { status: 400 })
    }

    // 1. Generate lyrics
    const lyrics = await generateLyrics(rhythm, melody, vocals)

    // 2. Build fusion payload
    const payload = fuseCharacters(rhythm, melody, vocals, lyrics)

    // 3. Submit to ACE-Step
    const taskId = await releaseTask(payload)

    // 4. Poll for result — timeout 20s antes del límite de Vercel
    const audioBuffer = await waitForResult(taskId, undefined, 280000)

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `inline; filename="${taskId}.wav"`,
        'X-Task-Id': taskId,
        'X-Lyrics': encodeURIComponent(lyrics),
      },
    })
  } catch (error: any) {
    console.error('Generation error:', error)
    const isTimeout = error.message?.includes('Timeout')
    return NextResponse.json(
      { error: error.message || 'Error en la generación' },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
