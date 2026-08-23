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
  // Impide que el LM reescriba nuestro caption antes de pasarlo al DiT.
  //
  // Con el default (true) el DiT NUNCA ve lo que mandamos. Capturado en el log
  // de un worker: enviamos "female whispered vocals" y el bloque
  // "DiT TEXT ENCODER INPUT" recibió "The male lead vocal is delivered with an
  // angsty strain". El mismo mecanismo se comía el instrumento principal.
  //
  // Explica el "a veces sí, a veces no": la reescritura es estocástica. Y
  // explica por qué recortar a 12 tags ayudó a medias — mejoraba el texto que
  // entra al LM, no el que llega al generador.
  use_cot_caption: boolean
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

// ── Refuerzo del instrumento principal ──────────────────────────────────────
// El modelo turbo tiende a "leer" tags abstractos de mood como sinte/piano y a
// dejar caer el instrumento acústico real (ver: violín→sintetizador, sax casi
// ausente). Tres refuerzos con variación + un token de "familia" le dan al DiT
// la señal no ambigua de cuál es el lead, y el token de familia emula el timbre
// de una sección real (brass/string section) en vez de un adjetivo suelto.
function instrumentFamily(instrument: string): string | null {
  const i = instrument.toLowerCase()
  // Piano-synth -> piano: guitarra sintetizada no aporta un second lead; que el
  // DiT trate "piano synth" como piano (acústico) y no como synth de sonido.
  if (/bass/.test(i)) return 'live bass'
  if (/synt|electro|synth|digital|wave|arp/.test(i)) {
    // si es "piano synth" lo tratamos como piano (no synth)
    if (/piano/.test(i)) return 'piano'
    return 'synth'
  }
  if (/sax|saxophone|clarinet|flute|trumpet|trombone|horn|brass/.test(i)) return 'brass section'
  if (/violin|viola|cello|string|bow/.test(i)) return 'string section'
  if (/organ|hammond|pipe organ/.test(i)) return 'hammond organ'
  if (/piano|keyboard|keys/.test(i)) return 'piano'
  if (/drum|kit|percussion/.test(i)) return 'live drum kit'
  if (/guitar/.test(i)) return 'live guitar'
  return null
}
function instrumentReinforcement(instrument: string, genreLabel: string): string[] {
  if (!instrument) return []
  return [
    `${instrument}-led ${genreLabel}`,
    instrument.includes('bass') ? 'melodic bass lead' : `${instrument} lead`,
    `prominent ${instrument} solo`,
  ]
}

// ── Filtro de mood "ambiente / electrónico" ────────────────────────────────
// Estos adjetivos abstractos no refuerzan un instrumento acústico real y
// desvían al DiT hacía un timbre synth/piano (ver: sax→piano, violín→synth).
// Para leads acústicos (brass/string/piano/guitar/drums) se eliminan de los
// extras; para leads synth/electronic se conservan, porque ahí un sonido
// "atmosférico" sí es el estilo. Sustitución opcional con la familia.
const AMBIENT_TERMS = [
  'detached', 'cerebral', 'isolation', 'float', 'floating', 'awe', 'groovy', 'ether',
]
function filterAmbient(tokens: string[], acousticFamily: boolean): string[] {
  if (!acousticFamily) return tokens
  return tokens.filter(t => !AMBIENT_TERMS.some(a => t.toLowerCase().includes(a)))
}

// El prompt es condicionamiento suave, no instrucciones: cada tag extra diluye
// a los demás. Con 22 tags el modelo ignoraba el instrumento principal y el
// género vocal. Este tope obliga a que solo sobreviva lo que más define la
// canción.
const MAX_PROMPT_TAGS = 12

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
  //
  // Cambio Route 2: el instrumento se refuerza 3× con variación (led / lead /
  // solo) y se añade un token de familia (brass section, string section...)
  // DELANTE del label de género, para que el DiT lo vea primero y como familia
  // real, no como un adjetivo que la distorsión del mood pueda derribar.
  const instrumentTokens = leadInstrument
    ? [
        ...instrumentReinforcement(leadInstrument, genreLabel),
        instrumentFamily(leadInstrument),
      ].filter(Boolean)
    : []

  // ¿Es un instrumento acústico (no synth/eléctrico)? Si sí, filtramos los
  // moods ambiente/electrónico de los extras para no empujar hacia synth/piano.
  const family = instrumentFamily(leadInstrument)
  const acousticFamily = family !== 'synth' && family !== null

  const core = [
    ...instrumentTokens,
    vocalTag,
    `key of ${mp.key_preference} ${mp.mode}`,
    // Un solo tag: con la coma dentro contaría como dos contra el presupuesto.
    weirdness > 0.6 ? 'experimental and unconventional' : null,
  ].filter(Boolean) as string[]

  // Color: se toma en rondas para que los tres personajes aporten algo antes de
  // que nadie aporte su segundo rasgo. Si se concatenaran las listas enteras,
  // el ritmo gastaría el presupuesto y las vocales no llegarían.
  // Route 2: si el lead es acústico, se filtran los moods ambiente/electrónico.
  const rounds = [
    filterAmbient(rhythmKeywords, acousticFamily) as string[],
    filterAmbient(melodyKeywords, acousticFamily) as string[],
    filterAmbient(vocalsKeywords, acousticFamily) as string[],
  ]
  const extras: string[] = []
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
    use_cot_caption: false,
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
