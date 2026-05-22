'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CharacterCard } from '@/components/CharacterCard'
import { AudioPlayer } from '@/components/AudioPlayer'
import type { Character } from '@/lib/supabase'
import { getRoleLabel, getRoleIcon } from '@/lib/fusion'
import { formatGenre } from '@/lib/utils'

type GenerationState = 'idle' | 'lyrics' | 'generating' | 'done' | 'error'

const PROGRESS_MESSAGES = [
  'Analizando personajes...',
  'Generando letras con IA...',
  'Fundiendo estilos musicales...',
  'Procesando en ACE-Step...',
  'Renderizando audio...',
  'Normalizando...',
  'Casi listo...',
]

export default function FusePage() {
  const router = useRouter()
  const [rhythm, setRhythm] = useState<Character | null>(null)
  const [melody, setMelody] = useState<Character | null>(null)
  const [vocals, setVocals] = useState<Character | null>(null)
  const [state, setState] = useState<GenerationState>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [audioUrls, setAudioUrls] = useState<string[]>([])
  const [lyrics, setLyrics] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [msgIndex, setMsgIndex] = useState(0)

  // Limpiar blob URLs al desmontar o al generar nueva versión
  const revokeAudioUrls = (urls: string[]) => {
    urls.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u) })
  }

  useEffect(() => {
    return () => { revokeAudioUrls(audioUrls) }
  }, [audioUrls])

  useEffect(() => {
    const r = sessionStorage.getItem('selected_rhythm')
    const m = sessionStorage.getItem('selected_melody')
    const v = sessionStorage.getItem('selected_vocals')
    if (r) setRhythm(JSON.parse(r))
    if (m) setMelody(JSON.parse(m))
    if (v) setVocals(JSON.parse(v))
  }, [])

  // Cycle progress messages
  useEffect(() => {
    if (state !== 'generating' && state !== 'lyrics') return
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % PROGRESS_MESSAGES.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [state])

  useEffect(() => {
    setProgressMsg(PROGRESS_MESSAGES[msgIndex])
  }, [msgIndex])

  // Animate progress bar
  useEffect(() => {
    if (state === 'lyrics') {
      setProgress(15)
    } else if (state === 'generating') {
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 0.5, 92))
      }, 1000)
      return () => clearInterval(interval)
    } else if (state === 'done') {
      setProgress(100)
    }
  }, [state])

  const handleGenerate = async () => {
    if (!rhythm || !melody || !vocals) return

    setState('lyrics')
    setProgress(0)
    setError('')
    setAudioUrls([])
    setMsgIndex(0)

    try {
      setState('generating')
      setProgress(20)

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rhythm, melody, vocals }),
      })

      if (!res.ok) {
        let errMsg = 'Error desconocido'
        try {
          const errData = await res.json()
          errMsg = (typeof errData.error === 'string' ? errData.error : JSON.stringify(errData.error)) || errMsg
        } catch {}
        throw new Error(errMsg)
      }

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('audio/')) {
        // Respuesta binaria WAV — crear blob URL para el reproductor
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const rawLyrics = res.headers.get('X-Lyrics') || ''
        setAudioUrls([blobUrl])
        setLyrics(rawLyrics ? decodeURIComponent(rawLyrics) : '')
      } else {
        // Fallback JSON (legacy)
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Error desconocido')
        setAudioUrls(data.audioUrls || [])
        setLyrics(data.lyrics || '')
      }
      setState('done')

    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : typeof err === 'string' ? err : 'Algo salió mal')
      setState('error')
    }
  }

  const characters = [
    { char: rhythm, role: 'rhythm' },
    { char: melody, role: 'melody' },
    { char: vocals, role: 'vocals' },
  ]

  const isGenerating = state === 'generating' || state === 'lyrics'

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-steel px-8 py-4 flex items-center justify-between sticky top-0 bg-void/95 backdrop-blur z-20">
        <button onClick={() => router.push('/collection')} className="font-display text-2xl tracking-widest text-blood hover:text-crimson transition-colors">
          SOUNDFORGE
        </button>
        <button
          onClick={() => router.push('/collection')}
          className="font-mono text-xs text-smoke hover:text-bone transition-colors flex items-center gap-2"
        >
          ← Cambiar selección
        </button>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-8 py-12">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <h1 className="font-display text-5xl tracking-widest mb-2">FORGE YOUR SONG</h1>
          <p className="font-mono text-sm text-smoke">
            Fusión de 3 personajes → generación con ACE-Step IA
          </p>
        </motion.div>

        {/* Selected characters */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {characters.map(({ char, role }, i) => (
            <motion.div
              key={role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {char ? (
                <CharacterCard character={char} selected compact={false} />
              ) : (
                <div className="card border-ash/30 p-5 flex items-center justify-center h-48">
                  <div className="text-center">
                    <div className="text-3xl mb-2 opacity-30">{getRoleIcon(role)}</div>
                    <span className="label">{getRoleLabel(role)} no seleccionado</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Fusion info */}
        {rhythm && melody && vocals && state === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 grid grid-cols-3 gap-4"
          >
            {[
              { label: 'Tempo estimado', value: `${Math.round(((Number((rhythm.game_params as any)?.tempo_min) || 0) + (Number((rhythm.game_params as any)?.tempo_max) || 0)) / 2) || '—'} BPM` },
              { label: 'Tonalidad', value: `${(melody.game_params as any)?.key_preference || '—'} ${(melody.game_params as any)?.mode || ''}`.trim() },
              { label: 'Idioma', value: (vocals.game_params as any)?.language?.toUpperCase() || 'EN' },
            ].map(item => (
              <div key={item.label} className="border border-steel p-4 text-center">
                <div className="label mb-1">{item.label}</div>
                <div className="font-display text-2xl text-blood">{item.value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Generate button */}
        {state === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <button
              onClick={handleGenerate}
              disabled={!rhythm || !melody || !vocals}
              className="btn-primary text-lg px-16 py-5 disabled:opacity-30"
            >
              ⚡ GENERAR CANCIÓN
            </button>
            <p className="font-mono text-xs text-smoke mt-4">
              Requiere RunPod activo · ~30-60 segundos
            </p>
          </motion.div>
        )}

        {/* Progress */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              {/* Progress bar */}
              <div className="h-1 bg-steel mb-6 overflow-hidden">
                <motion.div
                  className="h-full bg-blood"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1 }}
                />
              </div>

              {/* Waveform animation */}
              <div className="flex items-center justify-center gap-1 h-16 mb-6">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-blood rounded-sm origin-bottom waveform-bar"
                    style={{
                      height: `${15 + Math.sin(i * 0.6) * 12}px`,
                      animationDelay: `${(i % 10) * 0.12}s`,
                    }}
                  />
                ))}
              </div>

              <motion.p
                key={progressMsg}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-sm text-smoke mb-2"
              >
                {progressMsg}
              </motion.p>
              <p className="font-mono text-xs text-ash">{Math.round(progress)}%</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {state === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="border border-blood/40 bg-blood/5 p-6 mb-6">
              <p className="font-mono text-sm text-blood mb-2">Error en la generación</p>
              <p className="font-mono text-xs text-smoke">{error}</p>
            </div>
            <button onClick={() => setState('idle')} className="btn-ghost">
              Intentar de nuevo
            </button>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {state === 'done' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <div className="h-1 bg-blood mb-6" />
                <h2 className="font-display text-3xl tracking-widest text-bone mb-1">
                  ¡CANCIÓN GENERADA!
                </h2>
                <p className="font-mono text-xs text-smoke">
                  {audioUrls.length} variante{audioUrls.length !== 1 ? 's' : ''} generada{audioUrls.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Audio players */}
              {audioUrls.length > 0 ? (
                audioUrls.map((url, i) => (
                  <AudioPlayer
                    key={url}
                    src={url}
                    title={`Variante ${i + 1}`}
                    subtitle={`${formatGenre(rhythm?.genre || '')} × ${formatGenre(melody?.genre || '')} × ${formatGenre(vocals?.genre || '')}`}
                  />
                ))
              ) : (
                <div className="card border-ash/30 p-8 text-center">
                  <p className="font-mono text-sm text-smoke mb-2">
                    La canción fue generada pero el audio no está disponible para descarga directa.
                  </p>
                  <p className="font-mono text-xs text-ash">
                    Esto puede ocurrir si el servidor de ACE-Step no tiene un endpoint de audio activo.
                  </p>
                </div>
              )}

              {/* Lyrics */}
              {lyrics && (
                <div className="card border-ash/30 p-6">
                  <div className="label mb-4">Letras generadas</div>
                  <pre className="font-mono text-xs text-silver whitespace-pre-wrap leading-relaxed">
                    {lyrics}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    revokeAudioUrls(audioUrls)
                    setState('idle')
                    setAudioUrls([])
                    setLyrics('')
                  }}
                  className="btn-primary flex-1"
                >
                  ⚡ Generar otra versión
                </button>
                <button
                  onClick={() => router.push('/collection')}
                  className="btn-ghost flex-1"
                >
                  ← Cambiar personajes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
