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
  // Empuja al LM lejos de los instrumentos solistas que no son el principal.
  // El DiT turbo ignora CFG por completo ("Turbo model detected: overriding
  // guidance_scale 7.0 -> 1.0"), así que un prompt negativo no lo afecta; pero
  // el LM de 5Hz sí usa CFG (lm_cfg_scale 2.5) y es quien genera los audio
  // codes que condicionan al DiT. Es la única vía negativa que queda abierta.
  lm_negative_prompt: string
}

// NO activar use_format: la documentación dice que el LM reescribe "caption
// AND lyrics", y al probarlo la canción salió cantada en otro idioma pese a
// vocal_language: 'en'. El problema de fondo -- demasiados tags compitiendo --
// se ataca con MAX_PROMPT_TAGS, no delegando la letra al modelo.

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

// Los géneros son enums con guión bajo ("prog_rock"). Enviarlos crudos mete una
// no-palabra en el prompt; el modelo no la reconoce como género.
function genreWords(genre: string): string {
  return genre.replace(/_/g, ' ')
}

// El prompt es condicionamiento suave, no instrucciones: cada tag extra diluye
// a los demás. Con 22 tags el modelo ignoraba el instrumento principal y el
// género vocal. Este tope obliga a que solo sobreviva lo que más define la
// canción.
const MAX_PROMPT_TAGS = 12

// Instrumentos que en una grabación se llevan un solo y le roban el papel al
// principal. Un personaje de piano en jazz salía con un solo de saxofón: el
// modelo no lo añade porque se lo pidamos, sino porque el jazz de su corpus
// lleva saxofón. Se nombran en negativo, menos el que sí debe protagonizar.
//
// Solo instrumentos SOLISTAS: la sección rítmica no entra. Suprimir la guitarra
// de acompañamiento en una canción de rock la dejaría hueca.
const SOLO_INSTRUMENTS = [
  'saxophone', 'trumpet', 'brass section', 'flute', 'harmonica',
  'violin', 'piano', 'organ', 'guitar solo',
]

function competingInstruments(leadInstrument: string): string {
  const lead = leadInstrument.toLowerCase()
  const rivals = SOLO_INSTRUMENTS.filter(
    i => !lead.includes(i) && !i.includes(lead)
  )
  // "NO USER INPUT" es el valor por defecto que espera el servidor cuando no
  // hay nada que negar.
  return rivals.length ? rivals.join(', ') : 'NO USER INPUT'
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

  // Un solo género, no una fusión de tres. "jazz-prog_rock-grunge fusion" es
  // musicalmente contradictorio y el modelo terminaba eligiendo uno al azar.
  // Gana el personaje de mayor rareza: le da peso de juego al PWR, que hasta
  // ahora era puramente cosmético. Empate -> melodía, que ya aporta instrumento
  // y tonalidad.
  const genreOwner = [melody, rhythm, vocals].reduce((best, c) =>
    c.rarity_score > best.rarity_score ? c : best
  )
  const genreLabel = genreWords(genreOwner.genre)

  const uniqueGenres = [...new Set([rhythm.genre, melody.genre, vocals.genre])]

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

  // Núcleo: la identidad de la canción. Nunca se recorta. Los dos rasgos que el
  // modelo más ignoraba -- instrumento principal y género vocal -- abren el
  // prompt: enterrados a mitad de la lista se perdían, y un personaje de violín
  // salía sin violín mientras una voz femenina salía masculina.
  const core = [
    leadInstrument ? `${leadInstrument}-led ${genreLabel}` : genreLabel,
    vocalTag,
    leadInstrument ? `prominent ${leadInstrument} melody` : null,
    `key of ${mp.key_preference} ${mp.mode}`,
    // Un solo tag: con la coma dentro contaría como dos contra el presupuesto.
    weirdness > 0.6 ? 'experimental and unconventional' : null,
  ].filter(Boolean) as string[]

  // Color: se toma en rondas para que los tres personajes aporten algo antes de
  // que nadie aporte su segundo rasgo. Si se concatenaran las listas enteras,
  // el ritmo gastaría el presupuesto y las vocales no llegarían.
  const extras: string[] = []
  const rounds = [rhythmKeywords, melodyKeywords, vocalsKeywords]
  for (let i = 0; i < Math.max(...rounds.map(r => r.length)); i++) {
    for (const list of rounds) {
      if (list[i]) extras.push(list[i])
    }
  }

  const prompt = [...core, ...extras]
    .slice(0, MAX_PROMPT_TAGS)
    .join(', ')

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
    lm_negative_prompt: competingInstruments(leadInstrument),
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
