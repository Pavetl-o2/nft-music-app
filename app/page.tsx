'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function HomePage() {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)

  const handleDemo = async () => {
    setConnecting(true)
    // En prototipo: simular wallet connection guardando en localStorage
    localStorage.setItem('wallet_address', '0xDEMO...1234')
    localStorage.setItem('wallet_mode', 'demo')
    await new Promise(r => setTimeout(r, 800))
    router.push('/collection')
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-steel px-8 py-4 flex items-center justify-between">
        <span className="font-display text-2xl tracking-widest text-blood">SOUNDFORGE</span>
        <span className="font-mono text-xs text-smoke tracking-widest">PROTOTYPE v0.1</span>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">

        {/* Background lines */}
        <div className="absolute inset-0 opacity-5">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute border-t border-bone w-full"
              style={{ top: `${i * 5.5}%` }} />
          ))}
        </div>

        {/* Red glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                        w-96 h-96 bg-blood/5 rounded-full blur-3xl" />

        <div className="relative z-10 text-center px-8 max-w-4xl">
          
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-3 mb-8"
          >
            <div className="h-px w-16 bg-blood" />
            <span className="font-mono text-xs tracking-[0.3em] text-blood uppercase">
              NFT Music Game
            </span>
            <div className="h-px w-16 bg-blood" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-[clamp(4rem,12vw,10rem)] leading-none tracking-wider mb-2"
          >
            FORGE YOUR
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-display text-[clamp(4rem,12vw,10rem)] leading-none tracking-wider text-blood mb-8"
          >
            SOUND
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="font-body text-silver text-lg max-w-xl mx-auto mb-12 leading-relaxed"
          >
            Combina tres NFTs — Ritmo, Melodía y Vocales — 
            para generar música única con IA. 
            Cada combinación es un experimento irrepetible.
          </motion.p>

          {/* Role cards preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-3 mb-12"
          >
            {[
              { icon: '🥁', label: 'Ritmo', sub: 'Tempo & Groove' },
              { icon: '+', label: '', sub: '', divider: true },
              { icon: '🎸', label: 'Melodía', sub: 'Key & Timbre' },
              { icon: '+', label: '', sub: '', divider: true },
              { icon: '🎤', label: 'Vocales', sub: 'Style & Emotion' },
              { icon: '=', label: '', sub: '', divider: true },
              { icon: '🎵', label: 'Canción', sub: 'Única', highlight: true },
            ].map((item, i) => (
              item.divider ? (
                <span key={i} className="font-display text-2xl text-ash">{item.icon}</span>
              ) : (
                <div key={i} className={`card p-4 text-center w-28 ${item.highlight ? 'border-blood' : ''}`}>
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className={`font-mono text-xs tracking-widest uppercase ${item.highlight ? 'text-blood' : 'text-bone'}`}>
                    {item.label}
                  </div>
                  <div className="font-mono text-xs text-smoke mt-0.5">{item.sub}</div>
                </div>
              )
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={handleDemo}
              disabled={connecting}
              className="btn-primary flex items-center gap-3 min-w-[220px] justify-center"
            >
              {connecting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Entrar en Demo
                </>
              )}
            </button>
            <button
              disabled
              className="btn-ghost flex items-center gap-3 min-w-[220px] justify-center opacity-40 cursor-not-allowed"
            >
              <span>🦊</span>
              Connect Wallet
              <span className="text-[10px] text-smoke ml-1">(pronto)</span>
            </button>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="font-mono text-xs text-smoke mt-8"
          >
            Prototipo — Los NFTs son simulados. La generación de música requiere RunPod activo.
          </motion.p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-steel px-8 py-4 flex items-center justify-between">
        <span className="font-mono text-xs text-smoke">333 NFTs · Ethereum Mainnet</span>
        <div className="flex gap-6">
          {['Rock', 'Punk', 'Grunge', 'Metal', 'Jazz'].map(g => (
            <span key={g} className="font-mono text-xs text-ash">{g}</span>
          ))}
        </div>
      </footer>
    </main>
  )
}
