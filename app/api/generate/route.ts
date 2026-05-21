import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateLyrics } from '@/lib/lyrics'
import { fuseCharacters } from '@/lib/fusion'
import { releaseTask, waitForResult } from '@/lib/acestep'
import type { Character } from '@/lib/supabase'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Obtener game_params completos desde Supabase con service role
    // (el cliente no los tiene por seguridad)
    const { data: fullChars, error: dbError } = await supabaseAdmin
      .from('nft_characters')
      .select('id, name, role, genre, public_metadata, game_params, rarity_score')
      .in('id', [rhythm.id, melody.id, vocals.id])

    if (dbError || !fullChars || fullChars.length < 3) {
      return NextResponse.json({ error: 'No se pudieron cargar los personajes' }, { status: 500 })
    }

    const fullRhythm = fullChars.find(c => c.id === rhythm.id) as Character
    const fullMelody = fullChars.find(c => c.id === melody.id) as Character
    const fullVocals = fullChars.find(c => c.id === vocals.id) as Character

    // 1. Generate lyrics
    const lyrics = await generateLyrics(fullRhythm, fullMelody, fullVocals)

    // 2. Build fusion payload
    const payload = fuseCharacters(fullRhythm, fullMelody, fullVocals, lyrics)

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
