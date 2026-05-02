'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CharacterCard } from '@/components/CharacterCard'
import type { Character } from '@/lib/supabase'
import { getRoleLabel } from '@/lib/fusion'

// Demo characters using generated data sample
const DEMO_CHARACTERS: Character[] = [
  // RHYTHM
  {
    id: 'rhythm_rock_001', name: 'Storm Breaker', role: 'rhythm', genre: 'rock', rarity_score: 15,
    public_metadata: { role: 'Rhythm', genre: 'Rock', kit_type: 'Acoustic Drums' },
    game_params: { tempo_min: 115, tempo_max: 145, time_signature: '4/4', groove: 'driving', kit_type: 'acoustic drums', percussion_density: 0.7, swing: 0.05, feel_keywords: ['tight', 'powerful', 'steady'], fx_keywords: ['dry', 'room reverb'] }
  },
  {
    id: 'rhythm_punk_031', name: 'Riot Fang', role: 'rhythm', genre: 'punk', rarity_score: 20,
    public_metadata: { role: 'Rhythm', genre: 'Punk', kit_type: 'Acoustic Drums' },
    game_params: { tempo_min: 165, tempo_max: 195, time_signature: '4/4', groove: 'blast', kit_type: 'acoustic drums', percussion_density: 0.9, swing: 0.02, feel_keywords: ['fast', 'aggressive', 'raw'], fx_keywords: ['dry', 'raw'] }
  },
  {
    id: 'rhythm_grunge_053', name: 'Mud Walker', role: 'rhythm', genre: 'grunge', rarity_score: 25,
    public_metadata: { role: 'Rhythm', genre: 'Grunge', kit_type: 'Heavy Acoustic' },
    game_params: { tempo_min: 78, tempo_max: 115, time_signature: '4/4', groove: 'half-time', kit_type: 'heavy acoustic', percussion_density: 0.5, swing: 0.08, feel_keywords: ['lazy', 'heavy', 'sludgy'], fx_keywords: ['lo-fi', 'muddy'] }
  },
  {
    id: 'rhythm_heavy_metal_071', name: 'Blast Valkyrie', role: 'rhythm', genre: 'heavy_metal', rarity_score: 30,
    public_metadata: { role: 'Rhythm', genre: 'Heavy Metal', kit_type: 'Heavy Acoustic' },
    game_params: { tempo_min: 155, tempo_max: 205, time_signature: '4/4', groove: 'blast', kit_type: 'heavy acoustic', percussion_density: 0.95, swing: 0.01, feel_keywords: ['thunderous', 'precise', 'brutal'], fx_keywords: ['triggered', 'tight'] }
  },
  {
    id: 'rhythm_jazz_104', name: 'Brush Whisper', role: 'rhythm', genre: 'jazz', rarity_score: 60,
    public_metadata: { role: 'Rhythm', genre: 'Jazz', kit_type: 'Minimal Kit' },
    game_params: { tempo_min: 95, tempo_max: 145, time_signature: '3/4', groove: 'swing', kit_type: 'minimal kit', percussion_density: 0.35, swing: 0.65, feel_keywords: ['delicate', 'swinging', 'sophisticated'], fx_keywords: ['warm', 'natural'] }
  },
  {
    id: 'rhythm_funk_086', name: 'Pocket Queen', role: 'rhythm', genre: 'funk', rarity_score: 38,
    public_metadata: { role: 'Rhythm', genre: 'Funk', kit_type: 'Percussion Ensemble' },
    game_params: { tempo_min: 95, tempo_max: 118, time_signature: '4/4', groove: 'pocket', kit_type: 'percussion ensemble', percussion_density: 0.72, swing: 0.55, feel_keywords: ['groovy', 'tight', 'bouncy'], fx_keywords: ['tight', 'compressed'] }
  },

  // MELODY
  {
    id: 'melody_rock_001', name: 'Amp Queen', role: 'melody', genre: 'rock', rarity_score: 10,
    public_metadata: { role: 'Melody', genre: 'Rock', instrument: 'Distorted Electric Guitar' },
    game_params: { key_preference: 'E', mode: 'minor', lead_instrument: 'distorted electric guitar', harmonic_complexity: 0.45, tone_fx: ['overdrive', 'reverb'], mood_keywords: ['powerful', 'anthemic', 'soaring'], weirdness: 0.15 }
  },
  {
    id: 'melody_grunge_053', name: 'Rust Prophet', role: 'melody', genre: 'grunge', rarity_score: 28,
    public_metadata: { role: 'Melody', genre: 'Grunge', instrument: 'Distorted Guitar' },
    game_params: { key_preference: 'D', mode: 'minor', lead_instrument: 'distorted electric guitar', harmonic_complexity: 0.3, tone_fx: ['heavy distortion', 'flanger'], mood_keywords: ['dark', 'brooding', 'melancholic'], weirdness: 0.22 }
  },
  {
    id: 'melody_punk_031', name: 'Chainsaw Lucy', role: 'melody', genre: 'punk', rarity_score: 18,
    public_metadata: { role: 'Melody', genre: 'Punk', instrument: 'Distorted Electric Guitar' },
    game_params: { key_preference: 'A', mode: 'minor', lead_instrument: 'distorted electric guitar', harmonic_complexity: 0.15, tone_fx: ['heavy distortion', 'dry'], mood_keywords: ['angry', 'raw', 'urgent'], weirdness: 0.08 }
  },
  {
    id: 'melody_jazz_104', name: 'Blue Note', role: 'melody', genre: 'jazz', rarity_score: 72,
    public_metadata: { role: 'Melody', genre: 'Jazz', instrument: 'Saxophone' },
    game_params: { key_preference: 'Bb', mode: 'dorian', lead_instrument: 'saxophone', harmonic_complexity: 0.82, tone_fx: ['clean', 'warm'], mood_keywords: ['sophisticated', 'smooth', 'cool'], weirdness: 0.48 }
  },
  {
    id: 'melody_heavy_metal_071', name: 'Iron Shredder', role: 'melody', genre: 'heavy_metal', rarity_score: 35,
    public_metadata: { role: 'Melody', genre: 'Heavy Metal', instrument: 'Distorted Electric Guitar' },
    game_params: { key_preference: 'E', mode: 'phrygian', lead_instrument: 'distorted electric guitar', harmonic_complexity: 0.65, tone_fx: ['high-gain distortion', 'tight'], mood_keywords: ['brutal', 'epic', 'thunderous'], weirdness: 0.25 }
  },
  {
    id: 'melody_funk_086', name: 'Slap Sister', role: 'melody', genre: 'funk', rarity_score: 33,
    public_metadata: { role: 'Melody', genre: 'Funk', instrument: 'Bass Guitar' },
    game_params: { key_preference: 'G', mode: 'mixolydian', lead_instrument: 'bass guitar', harmonic_complexity: 0.52, tone_fx: ['clean', 'wah'], mood_keywords: ['groovy', 'smooth', 'soulful'], weirdness: 0.12 }
  },

  // VOCALS
  {
    id: 'vocals_rock_001', name: 'Echo Howler', role: 'vocals', genre: 'rock', rarity_score: 8,
    public_metadata: { role: 'Vocals', genre: 'Rock', vocal_style: 'Sung' },
    game_params: { vocal_gender: 'female', vocal_style: 'sung', delivery: 'powerful', intensity: 0.72, language: 'en', emotion_keywords: ['passion', 'power', 'freedom'], lyric_theme: 'rebellion', style_weight: 0.65 }
  },
  {
    id: 'vocals_punk_031', name: 'Spit Valve', role: 'vocals', genre: 'punk', rarity_score: 18,
    public_metadata: { role: 'Vocals', genre: 'Punk', vocal_style: 'Shouted' },
    game_params: { vocal_gender: 'female', vocal_style: 'shouted', delivery: 'aggressive', intensity: 0.88, language: 'en', emotion_keywords: ['rage', 'rebellion', 'fury'], lyric_theme: 'anarchy', style_weight: 0.82 }
  },
  {
    id: 'vocals_grunge_053', name: 'Flannel Ghost', role: 'vocals', genre: 'grunge', rarity_score: 30,
    public_metadata: { role: 'Vocals', genre: 'Grunge', vocal_style: 'Whispered' },
    game_params: { vocal_gender: 'female', vocal_style: 'whispered', delivery: 'haunting', intensity: 0.42, language: 'en', emotion_keywords: ['despair', 'apathy', 'pain'], lyric_theme: 'isolation', style_weight: 0.55 }
  },
  {
    id: 'vocals_heavy_metal_071', name: 'Iron Siren', role: 'vocals', genre: 'heavy_metal', rarity_score: 40,
    public_metadata: { role: 'Vocals', genre: 'Heavy Metal', vocal_style: 'Shouted' },
    game_params: { vocal_gender: 'female', vocal_style: 'shouted', delivery: 'commanding', intensity: 0.92, language: 'en', emotion_keywords: ['rage', 'power', 'darkness'], lyric_theme: 'war', style_weight: 0.88 }
  },
  {
    id: 'vocals_jazz_104', name: 'Velvet Throat', role: 'vocals', genre: 'jazz', rarity_score: 58,
    public_metadata: { role: 'Vocals', genre: 'Jazz', vocal_style: 'Breathy' },
    game_params: { vocal_gender: 'female', vocal_style: 'breathy', delivery: 'sultry', intensity: 0.38, language: 'en', emotion_keywords: ['longing', 'sophistication', 'warmth'], lyric_theme: 'night', style_weight: 0.45 }
  },
  {
    id: 'vocals_funk_086', name: 'Soul Mama', role: 'vocals', genre: 'funk', rarity_score: 35,
    public_metadata: { role: 'Vocals', genre: 'Funk', vocal_style: 'Sung' },
    game_params: { vocal_gender: 'female', vocal_style: 'sung', delivery: 'confident', intensity: 0.68, language: 'en', emotion_keywords: ['joy', 'confidence', 'groove'], lyric_theme: 'celebration', style_weight: 0.72 }
  },
]

const ROLES = ['rhythm', 'melody', 'vocals'] as const

export default function CollectionPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, Character | null>>({
    rhythm: null, melody: null, vocals: null
  })
  const [activeRole, setActiveRole] = useState<string>('rhythm')
  const [filter, setFilter] = useState<string>('all')

  const characters = DEMO_CHARACTERS.filter(c => c.role === activeRole)
  const filtered = filter === 'all' ? characters : characters.filter(c => c.genre === filter)
  const genres = ['all', ...Array.from(new Set(characters.map(c => c.genre)))]

  const allSelected = ROLES.every(r => selected[r] !== null)

  const handleSelect = (char: Character) => {
    setSelected(prev => ({
      ...prev,
      [char.role]: prev[char.role]?.id === char.id ? null : char
    }))
  }

  const handleFuse = () => {
    if (!allSelected) return
    sessionStorage.setItem('selected_rhythm', JSON.stringify(selected.rhythm))
    sessionStorage.setItem('selected_melody', JSON.stringify(selected.melody))
    sessionStorage.setItem('selected_vocals', JSON.stringify(selected.vocals))
    router.push('/fuse')
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-steel px-8 py-4 flex items-center justify-between sticky top-0 bg-void/95 backdrop-blur z-20">
        <button onClick={() => router.push('/')} className="font-display text-2xl tracking-widest text-blood hover:text-crimson transition-colors">
          SOUNDFORGE
        </button>
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs text-smoke">
            Demo · 0xDEMO...1234
          </span>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - Selection summary */}
        <aside className="w-72 border-r border-steel p-6 flex flex-col gap-6 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <div>
            <h2 className="font-display text-xl tracking-wider mb-1">TU BANDA</h2>
            <p className="font-mono text-xs text-smoke">Selecciona uno de cada rol</p>
          </div>

          {/* Selected slots */}
          {ROLES.map(role => (
            <div key={role}>
              <div className="label mb-2">{getRoleLabel(role)}</div>
              {selected[role] ? (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="card border-blood/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-base tracking-wider">{selected[role]!.name}</div>
                      <div className="font-mono text-xs text-smoke">{selected[role]!.public_metadata.genre}</div>
                    </div>
                    <button
                      onClick={() => setSelected(p => ({ ...p, [role]: null }))}
                      className="text-smoke hover:text-blood transition-colors text-lg"
                    >
                      ×
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="border border-dashed border-ash/40 p-3 text-center">
                  <span className="font-mono text-xs text-smoke/50">Sin selección</span>
                </div>
              )}
            </div>
          ))}

          {/* Fuse button */}
          <div className="mt-auto">
            {allSelected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 p-3 border border-blood/20 bg-blood/5"
              >
                <p className="font-mono text-xs text-blood text-center">
                  ¡Banda lista! Genera tu canción
                </p>
              </motion.div>
            )}
            <button
              onClick={handleFuse}
              disabled={!allSelected}
              className={`w-full btn-primary py-4 ${!allSelected ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              ⚡ FORGE SONG
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 p-8">
          {/* Role tabs */}
          <div className="flex gap-0 mb-6 border border-steel w-fit">
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => { setActiveRole(role); setFilter('all') }}
                className={`font-mono text-xs tracking-widest uppercase px-6 py-3 transition-colors
                  ${activeRole === role ? 'bg-blood text-white' : 'text-smoke hover:text-bone'}`}
              >
                {getRoleLabel(role)}
                {selected[role] && (
                  <span className="ml-2 w-2 h-2 bg-white rounded-full inline-block" />
                )}
              </button>
            ))}
          </div>

          {/* Genre filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {genres.map(g => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={`font-mono text-xs tracking-widest uppercase px-3 py-1.5 border transition-colors
                  ${filter === g ? 'border-bone text-bone bg-steel' : 'border-ash/40 text-smoke hover:border-smoke'}`}
              >
                {g === 'all' ? 'Todos' : g.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Character grid */}
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {filtered.map((char, i) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <CharacterCard
                    character={char}
                    selected={selected[char.role]?.id === char.id}
                    onClick={() => handleSelect(char)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
