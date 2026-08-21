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
  // Deja que el LM reescriba nuestra lista de tags como una descripción
  // coherente antes de generar. Nuestro prompt son ~19 tags planos con señales
  // que compiten entre sí, y el modelo acababa quedándose con las equivocadas.
  use_format: boolean
}

// Efectos de pedal de guitarra. Los datos se los asignan a personajes de piano
// (6 de 111 melodías) y a personajes de ritmo (8 de 111), sin mirar qué
// instrumento lleva la melodía. Esas señales dominan la lectura del modelo: un
// personaje de piano acabó generando guitarra distorsionada. Se filtran de
// AMBAS fuentes cuando el instrumento principal no es una guitarra.
const GUITAR_FX = [
  'distortion', 'distorted', 'wah', 'fuzz', 'overdrive', 'crunch', 'feedback', 'palm mute',
]

function dropGuitarFx(keywords: string[], isGuitarLead: boolean): string[] {
  if (isGuitarLead) return keywords
  return keywords.filter(k => !GUITAR_FX.some(g => k.toLowerCase().includes(g)))
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

  const leadInstrument: string = mp.lead_instrument || ''
  const isGuitarLead = /guitar/i.test(leadInstrument)

  // Style prompt fusion
  const rhythmKeywords = [
    rp.kit_type,
    rp.groove,
    ...(rp.feel_keywords || []),
    ...dropGuitarFx(rp.fx_keywords || [], isGuitarLead),
  ].filter(Boolean)

  // El instrumento principal NO va aquí: se coloca al frente del prompt para
  // que no quede sepultado entre los demás tags.
  const melodyKeywords = [
    mp.mode,
    ...(mp.mood_keywords || []),
    ...dropGuitarFx(mp.tone_fx || [], isGuitarLead),
  ].filter(Boolean)

  // vocal_gender viene en los datos; antes se hardcodeaba "female" y el campo
  // se ignoraba. Hoy los 111 personajes son female, así que el valor coincide,
  // pero dejarlo hardcodeado rompería en silencio al agregar personajes.
  const vocalGender: string = vp.vocal_gender || 'female'
  const vocalTag = `${vocalGender} ${vp.vocal_style} vocals`

  const vocalsKeywords = [
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

  // Los dos rasgos que el modelo más ignoraba -- instrumento principal y género
  // vocal -- abren el prompt. Enterrados a mitad de la lista se perdían: un
  // personaje de piano generaba guitarra distorsionada, y una voz femenina
  // salía masculina.
  const prompt = [
    leadInstrument ? `${leadInstrument}-led ${genreLabel}` : genreLabel,
    vocalTag,
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
    use_format: true,
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
