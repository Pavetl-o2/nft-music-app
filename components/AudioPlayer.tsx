'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface AudioPlayerProps {
  src: string
  title: string
  subtitle?: string
}

export function AudioPlayer({ src, title, subtitle }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setProgress((audio.currentTime / audio.duration) * 100 || 0)
    }

    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      await audio.play()
      setPlaying(true)
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = pct * audio.duration
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="card border-blood/30 p-6">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Title */}
      <div className="mb-5">
        <h3 className="font-display text-xl tracking-wider text-bone">{title}</h3>
        {subtitle && (
          <p className="font-mono text-xs text-smoke mt-1">{subtitle}</p>
        )}
      </div>

      {/* Waveform visualization */}
      <div className="flex items-center gap-0.5 h-10 mb-5 justify-center">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className={`w-1 bg-blood rounded-sm origin-bottom ${playing ? 'waveform-bar' : ''}`}
            style={{
              height: `${20 + Math.sin(i * 0.8) * 15 + Math.cos(i * 0.4) * 10}px`,
              animationDelay: playing ? `${(i % 10) * 0.12}s` : '0s',
              opacity: progress > 0 ? (i / 30 < progress / 100 ? 1 : 0.3) : 0.3,
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div
        className="h-1 bg-steel mb-2 cursor-pointer relative"
        onClick={seek}
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-blood"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time */}
      <div className="flex justify-between mb-5">
        <span className="font-mono text-xs text-smoke">{fmt(currentTime)}</span>
        <span className="font-mono text-xs text-smoke">{fmt(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = 0
            setProgress(0)
          }}
          className="text-smoke hover:text-bone transition-colors"
          title="Reiniciar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </button>

        <button
          onClick={toggle}
          className="w-14 h-14 bg-blood hover:bg-crimson flex items-center justify-center transition-colors"
        >
          {playing ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <a
          href={src}
          download={`${title}.wav`}
          className="text-smoke hover:text-bone transition-colors"
          title="Descargar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </a>
      </div>
    </div>
  )
}
