import type { Character } from './supabase'

export interface FusionPayload {
  prompt: string
  lyrics: string
  bpm: number
  key_scale: string
  time_signature: string
  // Omitido a propósito: cuando falta, el LM de ACE-Step lo calcula desde la
  // letra y planea el arreglo para que la canción CONCLUYA. Si lo mandamos,
  // genera exactamente N segundos y corta donde caiga.
  audio_duration?: number
  batch_size: number
  inference_steps: number
  vocal_language: string
  thinking: boolean
  audio_format: string
}

// Efectos de pedal de guitarra. En los datos hay personajes de piano con estos
// FX asignados, y esas señales dominan la lectura del modelo: un personaje de
// piano acabó generando guitarra distorsionada. Se filtran cuando el
// instrumento principal no es una guitarra.
const GUITAR_FX = ['distortion', 'wah', 'fuzz', 'overdrive', 'crunch', 'feedback', 'palm mute']

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

  const leadInstrument: string = mp.lead_instrument || ''
  const isGuitarLead = /guitar/i.test(leadInstrument)

  const toneFx: string[] = (mp.tone_fx || []).filter((fx: string) =>
    isGuitarLead || !GUITAR_FX.some(g => fx.toLowerCase().includes(g))
  )

  // El instrumento principal NO va aquí: se coloca al frente del prompt para
  // que no quede sepultado entre los demás tags.
  const melodyKeywords = [
    mp.mode,
    ...(mp.mood_keywords || []),
    ...toneFx,
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

  // El modelo turbo está destilado para 8 pasos (rango válido 1-20). Más pasos
  // no mejoran la calidad, solo queman GPU — y en serverless se paga por
  // segundo. La sinergia de género da un paso extra, nada más.
  const sameGenre = uniqueGenres.length === 1
  const inferenceSteps = sameGenre ? 9 : 8

  // Weirdness: max de los 3
  const weirdness = Math.max(
    Number(mp.weirdness) || 0,
    0.1
  )

  // El instrumento principal abre el prompt y se refuerza justo después. Antes
  // iba como un tag más a mitad de la lista y el modelo lo ignoraba: un
  // personaje de piano generaba guitarra distorsionada.
  const prompt = [
    leadInstrument ? `${leadInstrument}-led ${genreLabel}` : genreLabel,
    leadInstrument ? `prominent ${leadInstrument} melody` : null,
    ...rhythmKeywords,
    ...melodyKeywords,
    ...vocalsKeywords,
    `key of ${mp.key_preference} ${mp.mode}`,
    weirdness > 0.6 ? 'experimental, unconventional' : null,
  ].filter(Boolean).join(', ')

  return {
    prompt,
    lyrics,
    bpm,
    key_scale: keyScale,
    time_signature: timeSig,
    // audio_duration se omite adrede — ver el comentario en FusionPayload.
    batch_size: 1,
    inference_steps: inferenceSteps,
    vocal_language: vp.language || 'en',
    thinking: true,
    // mp3, no wav: en serverless el audio vuelve en base64 dentro del JSON.
    // Un wav de un par de minutos son ~23MB (~31MB en base64), por encima del
    // límite de payload de RunPod. En mp3 el mismo audio son ~3MB.
    audio_format: 'mp3',
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
