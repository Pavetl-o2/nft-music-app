'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CharacterCard } from '@/components/CharacterCard'
import { supabase, type Character } from '@/lib/supabase'
import { getRoleLabel } from '@/lib/fusion'
import { formatGenre } from '@/lib/utils'

type CharacterWithImage = Character & { image_url?: string | null }

type ArtPrompt = {
  id: string
  positive_prompt: string
  negative_prompt: string
  archetype: string
}

const NEGATIVE_PROMPT = "bad anatomy, bad hands, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, text, error, missing limb, floating limbs, disconnected limbs, malformed hands, long neck, mutated, ugly, deformed, (nsfw:1.3), realistic, photo, photography, 3d render"

const ROLES = ['rhythm', 'melody', 'vocals'] as const

export default function CollectionPage() {
  const router = useRouter()
  const [characters, setCharacters] = useState<CharacterWithImage[]>([])
  const [artPrompts, setArtPrompts] = useState<ArtPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, CharacterWithImage | null>>({
    rhythm: null, melody: null, vocals: null
  })
  const [activeRole, setActiveRole] = useState<string>('rhythm')
  const [filter, setFilter] = useState<string>('all')
  const [detailChar, setDetailChar] = useState<CharacterWithImage | null>(null)
  const [promptsLoaded, setPromptsLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [copiedPositive, setCopiedPositive] = useState(false)
  const [copiedNegative, setCopiedNegative] = useState(false)
  const [adminMode, setAdminMode] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptsFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCharacters()
  }, [])

  async function loadCharacters() {
    setLoading(true)
    const { data, error } = await supabase
      .from('nft_characters')
      .select('id, name, role, genre, public_metadata, rarity_score, image_url')
      .order('rarity_score', { ascending: false })

    if (!error && data) {
      setCharacters(data as CharacterWithImage[])
    }
    setLoading(false)
  }

  function handleLoadPrompts(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        setArtPrompts(data)
        setPromptsLoaded(true)
      } catch {
        alert('Error leyendo art_prompts.json')
      }
    }
    reader.readAsText(file)
  }

  function getPrompt(charId: string): ArtPrompt | null {
    return artPrompts.find(p => p.id === charId) || null
  }

  const roleCharacters = characters.filter(c => c.role === activeRole)
  const filtered = filter === 'all'
    ? roleCharacters
    : roleCharacters.filter(c => c.genre === filter)

  const genres = ['all', ...Array.from(new Set(roleCharacters.map(c => c.genre)))]
  const allSelected = ROLES.every(r => selected[r] !== null)

  const withImage = characters.filter(c => c.image_url).length

  function handleSelect(char: CharacterWithImage) {
    if (adminMode) {
      setDetailChar(char)
      return
    }
    setSelected(prev => ({
      ...prev,
      [char.role]: prev[char.role]?.id === char.id ? null : char
    }))
  }

  function handleFuse() {
    if (!allSelected) return
    sessionStorage.setItem('selected_rhythm', JSON.stringify(selected.rhythm))
    sessionStorage.setItem('selected_melody', JSON.stringify(selected.melody))
    sessionStorage.setItem('selected_vocals', JSON.stringify(selected.vocals))
    router.push('/fuse')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!detailChar) return
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadSuccess(false)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('characterId', detailChar.id)

    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setUploadSuccess(true)
        const updatedChar = { ...detailChar, image_url: data.imageUrl }
        setCharacters(prev => prev.map(c => c.id === detailChar.id ? updatedChar : c))
        setDetailChar(updatedChar)
        setTimeout(() => setUploadSuccess(false), 3000)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Error subiendo imagen')
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function copyText(text: string, type: 'positive' | 'negative') {
    navigator.clipboard.writeText(text)
    if (type === 'positive') {
      setCopiedPositive(true)
      setTimeout(() => setCopiedPositive(false), 2000)
    } else {
      setCopiedNegative(true)
      setTimeout(() => setCopiedNegative(false), 2000)
    }
  }

  const prompt = detailChar ? getPrompt(detailChar.id) : null

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-steel px-8 py-4 flex items-center justify-between sticky top-0 bg-void/95 backdrop-blur z-20">
        <button onClick={() => router.push('/')}
          className="font-display text-2xl tracking-widest text-blood hover:text-crimson transition-colors">
          SOUNDFORGE
        </button>
        <div className="flex items-center gap-4">
          {/* Admin mode toggle */}
          <button
            onClick={() => { setAdminMode(!adminMode); setDetailChar(null) }}
            className={`font-mono text-xs tracking-widest uppercase px-4 py-2 border transition-colors ${
              adminMode
                ? 'border-gold text-gold bg-gold/10'
                : 'border-ash text-smoke hover:border-bone hover:text-bone'
            }`}
          >
            {adminMode ? '⚙ Modo Admin ON' : '⚙ Modo Admin'}
          </button>
          <span className="font-mono text-xs text-smoke">Demo · 0xDEMO...1234</span>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-72 border-r border-steel p-6 flex flex-col gap-6 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">

          {/* Admin mode tools */}
          {adminMode ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl tracking-wider mb-1 text-gold">MODO ADMIN</h2>
                <p className="font-mono text-xs text-smoke">Haz clic en un personaje para ver su prompt y subir imagen</p>
              </div>

              {/* Progress */}
              <div className="border border-steel p-4">
                <div className="flex justify-between mb-2">
                  <span className="label">Progreso de arte</span>
                  <span className="font-mono text-xs text-blood">
                    {withImage}/{characters.length}
                  </span>
                </div>
                <div className="h-1 bg-steel">
                  <div className="h-full bg-blood transition-all"
                    style={{ width: `${characters.length ? (withImage / characters.length) * 100 : 0}%` }} />
                </div>
                <div className="font-mono text-xs text-smoke mt-1 text-right">
                  {characters.length ? Math.round((withImage / characters.length) * 100) : 0}% completo
                </div>
              </div>

              {/* Load prompts */}
              <div>
                <input
                  ref={promptsFileRef}
                  type="file"
                  accept=".json"
                  onChange={handleLoadPrompts}
                  className="hidden"
                />
                <button
                  onClick={() => promptsFileRef.current?.click()}
                  className={`w-full font-mono text-xs tracking-widest uppercase py-3 border transition-colors ${
                    promptsLoaded
                      ? 'border-blood text-blood bg-blood/5'
                      : 'border-ash text-smoke hover:border-bone hover:text-bone'
                  }`}
                >
                  {promptsLoaded
                    ? `✓ Prompts cargados (${artPrompts.length})`
                    : '↑ Cargar art_prompts.json'}
                </button>
                {!promptsLoaded && (
                  <p className="font-mono text-xs text-smoke/50 mt-2">
                    Genera el archivo corriendo:<br />
                    <code className="text-bone">python generate_art_prompts.py</code>
                  </p>
                )}
              </div>

              {/* Selected char info */}
              {detailChar && (
                <div className="border border-gold/30 bg-gold/5 p-3">
                  <div className="label text-gold mb-1">Personaje activo</div>
                  <div className="font-display text-base tracking-wider">{detailChar.name}</div>
                  <div className="font-mono text-xs text-smoke">{detailChar.role} · {formatGenre(detailChar.genre)}</div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Normal play mode */}
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
                        <div className="flex items-center gap-2">
                          {selected[role]!.image_url && (
                            <img src={selected[role]!.image_url!}
                              className="w-8 h-8 object-cover border border-ash/30" alt="" />
                          )}
                          <div>
                            <div className="font-display text-base tracking-wider">{selected[role]!.name}</div>
                            <div className="font-mono text-xs text-smoke">{selected[role]!.public_metadata.genre}</div>
                          </div>
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
                    <p className="font-mono text-xs text-blood text-center">¡Banda lista!</p>
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
            </>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col">

          {/* Detail panel (admin mode) */}
          <AnimatePresence>
            {adminMode && detailChar && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="border-b border-steel bg-iron/30 p-6"
              >
                <div className="flex gap-6 max-w-4xl">
                  {/* Image */}
                  <div className="w-24 h-24 flex-shrink-0 bg-steel/30 border border-ash/30 overflow-hidden relative">
                    {detailChar.image_url ? (
                      <img src={detailChar.image_url} alt={detailChar.name}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl opacity-20">♪</span>
                      </div>
                    )}
                    {uploadSuccess && (
                      <div className="absolute inset-0 bg-blood/30 flex items-center justify-center">
                        <span className="text-white">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="label mb-0.5">{detailChar.role} · {formatGenre(detailChar.genre)}</div>
                        <h2 className="font-display text-2xl tracking-wider">{detailChar.name}</h2>
                        <div className="font-mono text-xs text-smoke">{detailChar.id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Upload button */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="btn-primary flex items-center gap-2 py-2 px-4 text-xs"
                        >
                          {uploading ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Subiendo...
                            </>
                          ) : (
                            `↑ ${detailChar.image_url ? 'Reemplazar' : 'Subir imagen'}`
                          )}
                        </button>
                        {uploadSuccess && (
                          <span className="font-mono text-xs text-blood">✓ Guardado</span>
                        )}
                        <button
                          onClick={() => setDetailChar(null)}
                          className="font-mono text-smoke hover:text-bone transition-colors text-xl leading-none"
                        >×</button>
                      </div>
                    </div>

                    {/* Prompts */}
                    {!promptsLoaded ? (
                      <div className="border border-gold/30 bg-gold/5 px-4 py-2">
                        <p className="font-mono text-xs text-gold">
                          Carga <code>art_prompts.json</code> en el panel izquierdo para ver el prompt de ComfyUI
                        </p>
                      </div>
                    ) : prompt ? (
                      <div className="space-y-2">
                        {/* Positive */}
                        <div className="bg-steel/20 border border-ash/20 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="label text-[10px]">Positive Prompt</span>
                            <button
                              onClick={() => copyText(prompt.positive_prompt, 'positive')}
                              className="font-mono text-xs text-smoke hover:text-bone border border-ash/40 hover:border-bone px-2 py-0.5 transition-colors"
                            >
                              {copiedPositive ? '✓ Copiado' : 'Copiar'}
                            </button>
                          </div>
                          <p className="font-mono text-xs text-silver leading-relaxed line-clamp-2">
                            {prompt.positive_prompt}
                          </p>
                        </div>
                        {/* Negative */}
                        <div className="bg-steel/10 border border-ash/10 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="label text-[10px]">Negative Prompt</span>
                            <button
                              onClick={() => copyText(NEGATIVE_PROMPT, 'negative')}
                              className="font-mono text-xs text-smoke hover:text-bone border border-ash/40 hover:border-bone px-2 py-0.5 transition-colors"
                            >
                              {copiedNegative ? '✓ Copiado' : 'Copiar'}
                            </button>
                          </div>
                          <p className="font-mono text-xs text-smoke/50 leading-relaxed line-clamp-1">
                            {NEGATIVE_PROMPT}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-mono text-xs text-smoke">
                        No se encontró prompt para <code>{detailChar.id}</code>
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Character grid area */}
          <div className="flex-1 p-8 overflow-y-auto">
            {/* Stats */}
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
                {adminMode && (
                  <span className="font-mono text-xs text-smoke">
                    Con imagen: <span className="text-blood">{withImage}</span>
                  </span>
                )}
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
                  {!adminMode && selected[role] && (
                    <span className="ml-2 w-2 h-2 bg-white rounded-full inline-block" />
                  )}
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

            {/* Loading */}
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

            {/* Grid */}
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
                      className="relative"
                    >
                      {/* Admin mode: image status indicator */}
                      {adminMode && (
                        <div className={`absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center text-xs font-mono
                          ${char.image_url ? 'bg-blood text-white' : 'bg-ash/50 text-smoke'}`}>
                          {char.image_url ? '✓' : '○'}
                        </div>
                      )}
                      <CharacterCard
                        character={char}
                        selected={
                          adminMode
                            ? detailChar?.id === char.id
                            : selected[char.role]?.id === char.id
                        }
                        onClick={() => handleSelect(char)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-24">
                <p className="font-mono text-sm text-smoke">Sin personajes para este filtro</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
