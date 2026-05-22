import type { Character } from './supabase'

export interface FusionPayload {
  prompt: string
  lyrics: string
  bpm: number
  key_scale: string
  time_signature: string
  audio_duration: number
  batch_size: number
  inference_steps: number
  vocal_language: string
  thinking: boolean
  audio_format: string
}

export function fuseCharacters(
  rhythm: Character,
  melody: Character,
  vocals: Character,
  lyrics: string
): FusionPayload {
  const rp = rhythm.game_params as any
  const mp = melody.game_params as any
  const vp = vocals.game_params as any

  // BPM: 60% rhythm, 30% melody (implied by genre), 10% vocals
  const tempoMid = (rp.tempo_min + rp.tempo_max) / 2
  const bpm = Math.round(tempoMid)

  // Key from melody
  const keyScale = `${mp.key_preference} ${mp.mode}`

  // Time signature from rhythm
  const timeSig = rp.time_signature?.split('/')[0] || '4'

  // Style prompt fusion
  const rhythmKeywords = [
    rp.kit_type,
    rp.groove,
    ...(rp.feel_keywords || []),
    ...(rp.fx_keywords || []),
  ].filter(Boolean)

  const melodyKeywords = [
    mp.lead_instrument,
    mp.mode,
    ...(mp.mood_keywords || []),
    ...(mp.tone_fx || []),
  ].filter(Boolean)

  const vocalsKeywords = [
    `${vp.vocal_style} female vocals`,
    vp.delivery,
    ...(vp.emotion_keywords || []),
  ].filter(Boolean)

  // Genre fusion
  const genres = [rhythm.genre, melody.genre, vocals.genre]
  const uniqueGenres = [...new Set(genres)]
  const genreLabel = uniqueGenres.length === 1
    ? `${uniqueGenres[0]}`
    : `${uniqueGenres.join('-')} fusion`

  // Sinergia: mismo género x3 = más inference steps
  const sameGenre = uniqueGenres.length === 1
  const inferenceSteps = sameGenre ? 30 : 25

  // Weirdness: max de los 3
  const weirdness = Math.max(
    Number(mp.weirdness) || 0,
    0.1
  )

  const prompt = [
    genreLabel,
    ...rhythmKeywords,
    ...melodyKeywords,
    ...vocalsKeywords,
    `key of ${mp.key_preference} ${mp.mode}`,
    weirdness > 0.6 ? 'experimental, unconventional' : null,
  ].filter(Boolean).join(', ')

  const sungLines = lyrics.split('\n').filter(l => l.trim() && !l.trim().startsWith('[')).length
  const audioDuration = Math.min(120, Math.max(60, sungLines * 8 + 20))

  return {
    prompt,
    lyrics,
    bpm,
    key_scale: keyScale,
    time_signature: timeSig,
    audio_duration: audioDuration,
    batch_size: 1,
    inference_steps: inferenceSteps,
    vocal_language: vp.language || 'en',
    thinking: true,
    audio_format: 'wav',
  }
}

export function getRoleIcon(role: string) {
  switch (role) {
    case 'rhythm': return '🥁'
    case 'melody': return '🎸'
    case 'vocals': return '🎤'
    default: return '🎵'
  }
}

export function getRoleLabel(role: string) {
  switch (role) {
    case 'rhythm': return 'Ritmo'
    case 'melody': return 'Melodía'
    case 'vocals': return 'Vocales'
    default: return role
  }
}
