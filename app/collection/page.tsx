'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CharacterCard } from '@/components/CharacterCard'
import { supabase, type Character } from '@/lib/supabase'
import { getRoleLabel } from '@/lib/fusion'

const ROLES = ['rhythm', 'melody', 'vocals'] as const

export default function CollectionPage() {
  const router = useRouter()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, Character | null>>({
    rhythm: null, melody: null, vocals: null
  })
  const [activeRole, setActiveRole] = useState<string>('rhythm')
  const [filter, setFilter] = useState<string>('all')

  // Load characters from Supabase
  useEffect(() => {
    async function loadCharacters() {
      setLoading(true)
      const { data, error } = await supabase
        .from('nft_characters')
        .select('id, name, role, genre, public_metadata, rarity_score')
        .order('rarity_score', { ascending: false })

      if (error) {
        console.error('Error loading characters:', error)
      } else {
        setCharacters((data as Character[]) || [])
      }
      setLoading(false)
    }
    loadCharacters()
  }, [])

  const roleCharacters = characters.filter(c => c.role === activeRole)
  const filtered = filter === 'all'
    ? roleCharacters
    : roleCharacters.filter(c => c.genre === filter)

  const genres = ['all', ...Array.from(new Set(roleCharacters.map(c => c.genre)))]
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
        <span className="font-mono text-xs text-smoke">Demo · 0xDEMO...1234</span>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-72 border-r border-steel p-6 flex flex-col gap-6 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <div>
            <h2 className="font-display text-xl tracking-wider mb-1">TU BANDA</h2>
            <p className="font-mono text-xs text-smoke">Selecciona uno de cada rol</p>
          </div>

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
                    >×</button>
                  </div>
                </motion.div>
              ) : (
                <div className="border border-dashed border-ash/40 p-3 text-center">
                  <span className="font-mono text-xs text-smoke/50">Sin selección</span>
                </div>
              )}
            </div>
          ))}

          <div className="mt-auto">
            {allSelected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 p-3 border border-blood/20 bg-blood/5"
              >
                <p className="font-mono text-xs text-blood text-center">¡Banda lista! Genera tu canción</p>
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

          {/* Stats bar */}
          {!loading && (
            <div className="flex gap-6 mb-6">
              {ROLES.map(role => (
                <span key={role} className="font-mono text-xs text-smoke">
                  {getRoleLabel(role)}: <span className="text-bone">{characters.filter(c => c.role === role).length}</span>
                </span>
              ))}
              <span className="font-mono text-xs text-smoke">
                Total: <span className="text-blood">{characters.length}</span>
              </span>
            </div>
          )}

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
                {selected[role] && <span className="ml-2 w-2 h-2 bg-white rounded-full inline-block" />}
              </button>
            ))}
          </div>

          {/* Genre filter */}
          {!loading && (
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
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="flex items-center gap-1 h-10 justify-center mb-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="w-1 bg-blood rounded-sm waveform-bar"
                      style={{ height: `${15 + Math.sin(i * 0.8) * 10}px` }} />
                  ))}
                </div>
                <span className="font-mono text-xs text-smoke">Cargando personajes...</span>
              </div>
            </div>
          )}

          {/* Character grid */}
          {!loading && (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filtered.map((char, i) => (
                  <motion.div
                    key={char.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
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
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-24">
              <p className="font-mono text-sm text-smoke">No hay personajes para este filtro</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
