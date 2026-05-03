'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, type Character } from '@/lib/supabase'
import { formatGenre } from '@/lib/utils'

// Art prompts data - generated from generate_art_prompts.py
// After running the script, paste the prompts here or load from JSON
type ArtPrompt = {
  id: string
  name: string
  role: string
  genre: string
  archetype: string
  positive_prompt: string
  negative_prompt: string
}

const NEGATIVE_PROMPT = "bad anatomy, bad hands, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, text, error, missing limb, floating limbs, disconnected limbs, malformed hands, long neck, mutated, ugly, deformed, (nsfw:1.3), realistic, photo, photography, 3d render"

const ROLES = ['rhythm', 'melody', 'vocals'] as const
const GENRES = ['rock', 'punk', 'grunge', 'heavy_metal', 'funk', 'blues', 'jazz', 'psychedelic', 'prog_rock']

type CharacterWithImage = Character & { image_url?: string | null }

export default function AdminPage() {
  const [characters, setCharacters] = useState<CharacterWithImage[]>([])
  const [artPrompts, setArtPrompts] = useState<ArtPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChar, setSelectedChar] = useState<CharacterWithImage | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all') // all | with_image | without_image
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [promptLoaded, setPromptLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptFileRef = useRef<HTMLInputElement>(null)

  // Load characters from Supabase
  useEffect(() => {
    loadCharacters()
  }, [])

  async function loadCharacters() {
    setLoading(true)
    const { data, error } = await supabase
      .from('nft_characters')
      .select('id, name, role, genre, public_metadata, rarity_score, image_url')
      .order('role')
      .order('genre')
      .order('id')

    if (!error && data) {
      setCharacters(data as CharacterWithImage[])
    }
    setLoading(false)
  }

  // Load art_prompts.json
  function handleLoadPrompts(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        setArtPrompts(data)
        setPromptLoaded(true)
      } catch {
        alert('Error leyendo art_prompts.json')
      }
    }
    reader.readAsText(file)
  }

  function getPrompt(charId: string): ArtPrompt | null {
    return artPrompts.find(p => p.id === charId) || null
  }

  // Filter characters
  const filtered = characters.filter(c => {
    if (roleFilter !== 'all' && c.role !== roleFilter) return false
    if (genreFilter !== 'all' && c.genre !== genreFilter) return false
    if (statusFilter === 'with_image' && !c.image_url) return false
    if (statusFilter === 'without_image' && c.image_url) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Stats
  const withImage = characters.filter(c => c.image_url).length
  const withoutImage = characters.length - withImage

  // Upload image
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedChar) return
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadSuccess(false)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('characterId', selectedChar.id)

    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setUploadSuccess(true)
        // Update local state
        setCharacters(prev => prev.map(c =>
          c.id === selectedChar.id ? { ...c, image_url: data.imageUrl } : c
        ))
        setSelectedChar(prev => prev ? { ...prev, image_url: data.imageUrl } : null)
        setTimeout(() => setUploadSuccess(false), 3000)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      alert('Error subiendo imagen')
    }
    setUploading(false)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const prompt = selectedChar ? getPrompt(selectedChar.id) : null

  return (
    <main className="min-h-screen flex flex-col bg-void">
      {/* Header */}
      <header className="border-b border-steel px-8 py-4 flex items-center justify-between sticky top-0 bg-void/95 backdrop-blur z-20">
        <div>
          <span className="font-display text-2xl tracking-widest text-blood">SOUNDFORGE</span>
          <span className="font-mono text-xs text-smoke ml-4">/ ADMIN — Art Manager</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Load prompts button */}
          <div>
            <input
              ref={promptFileRef}
              type="file"
              accept=".json"
              onChange={handleLoadPrompts}
              className="hidden"
            />
            <button
              onClick={() => promptFileRef.current?.click()}
              className={`font-mono text-xs tracking-widest uppercase px-4 py-2 border transition-colors ${
                promptLoaded
                  ? 'border-blood text-blood'
                  : 'border-ash text-smoke hover:border-bone hover:text-bone'
              }`}
            >
              {promptLoaded ? `✓ Prompts cargados (${artPrompts.length})` : '↑ Cargar art_prompts.json'}
            </button>
          </div>
          <a href="/" className="font-mono text-xs text-smoke hover:text-bone transition-colors">
            ← Volver al sitio
          </a>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left panel - character list */}
        <div className="w-80 border-r border-steel flex flex-col">
          {/* Stats */}
          <div className="p-4 border-b border-steel grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="font-display text-2xl text-bone">{characters.length}</div>
              <div className="font-mono text-xs text-smoke">Total</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl text-blood">{withImage}</div>
              <div className="font-mono text-xs text-smoke">Con imagen</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl text-ash">{withoutImage}</div>
              <div className="font-mono text-xs text-smoke">Sin imagen</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 py-2 border-b border-steel">
            <div className="h-1 bg-steel">
              <div
                className="h-full bg-blood transition-all duration-500"
                style={{ width: `${characters.length ? (withImage / characters.length) * 100 : 0}%` }}
              />
            </div>
            <div className="font-mono text-xs text-smoke mt-1 text-right">
              {characters.length ? Math.round((withImage / characters.length) * 100) : 0}% completo
            </div>
          </div>

          {/* Filters */}
          <div className="p-3 border-b border-steel space-y-2">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-iron border border-ash px-3 py-1.5 font-mono text-xs text-bone placeholder-smoke/50 focus:outline-none focus:border-blood"
            />
            <div className="flex gap-1">
              {['all', 'rhythm', 'melody', 'vocals'].map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`flex-1 font-mono text-xs py-1 border transition-colors ${
                    roleFilter === r ? 'border-blood text-blood bg-blood/10' : 'border-ash text-smoke hover:border-bone'
                  }`}>
                  {r === 'all' ? 'All' : r.slice(0,1).toUpperCase() + r.slice(1,3)}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {['all', 'with_image', 'without_image'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`flex-1 font-mono text-[10px] py-1 border transition-colors ${
                    statusFilter === s ? 'border-blood text-blood bg-blood/10' : 'border-ash text-smoke hover:border-bone'
                  }`}>
                  {s === 'all' ? 'Todos' : s === 'with_image' ? '✓ Con img' : '○ Sin img'}
                </button>
              ))}
            </div>
          </div>

          {/* Character list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <span className="font-mono text-xs text-smoke">Cargando...</span>
              </div>
            ) : (
              <div>
                {filtered.map(char => (
                  <button
                    key={char.id}
                    onClick={() => { setSelectedChar(char); setUploadSuccess(false) }}
                    className={`w-full text-left px-4 py-3 border-b border-steel/50 flex items-center gap-3 transition-colors hover:bg-iron ${
                      selectedChar?.id === char.id ? 'bg-iron border-l-2 border-l-blood' : ''
                    }`}
                  >
                    {/* Image thumbnail */}
                    <div className="w-10 h-10 flex-shrink-0 bg-steel/50 border border-ash/30 overflow-hidden">
                      {char.image_url ? (
                        <img src={char.image_url} alt={char.name}
                          className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-smoke text-xs">○</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-sm tracking-wide text-bone truncate">{char.name}</div>
                      <div className="font-mono text-xs text-smoke">
                        {char.role} · {formatGenre(char.genre)}
                      </div>
                    </div>
                    {char.image_url && (
                      <span className="text-blood text-xs flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="p-8 text-center">
                    <span className="font-mono text-xs text-smoke">Sin resultados</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - character detail */}
        <div className="flex-1 p-8 overflow-y-auto">
          {!selectedChar ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="font-display text-4xl text-ash mb-4">SELECT A CHARACTER</div>
                <p className="font-mono text-xs text-smoke">
                  Selecciona un personaje de la lista para ver su prompt y subir su imagen
                </p>
                {!promptLoaded && (
                  <div className="mt-6 border border-gold/30 bg-gold/5 p-4 max-w-sm mx-auto">
                    <p className="font-mono text-xs text-gold">
                      ⚠ Carga el archivo <code>art_prompts.json</code> para ver los prompts de ComfyUI
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <motion.div
              key={selectedChar.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl"
            >
              {/* Character header */}
              <div className="flex items-start gap-6 mb-8">
                {/* Image preview */}
                <div className="w-40 h-40 flex-shrink-0 bg-steel/30 border border-ash/30 overflow-hidden relative">
                  {selectedChar.image_url ? (
                    <img
                      src={selectedChar.image_url}
                      alt={selectedChar.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <span className="text-4xl opacity-20">♪</span>
                      <span className="font-mono text-xs text-smoke/50">Sin imagen</span>
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="absolute inset-0 bg-blood/20 flex items-center justify-center">
                      <span className="text-white text-2xl">✓</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="label mb-1">{selectedChar.public_metadata.role} · {formatGenre(selectedChar.genre)}</div>
                  <h1 className="font-display text-4xl tracking-wider mb-2">{selectedChar.name}</h1>
                  <div className="font-mono text-xs text-smoke mb-1">ID: {selectedChar.id}</div>
                  <div className="font-mono text-xs text-smoke">
                    Rareza interna: {selectedChar.rarity_score}/100
                  </div>

                  {/* Trait badges */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {selectedChar.public_metadata.kit_type && (
                      <span className="font-mono text-xs bg-steel px-2 py-1 text-bone">
                        {selectedChar.public_metadata.kit_type}
                      </span>
                    )}
                    {selectedChar.public_metadata.instrument && (
                      <span className="font-mono text-xs bg-steel px-2 py-1 text-bone">
                        {selectedChar.public_metadata.instrument}
                      </span>
                    )}
                    {selectedChar.public_metadata.vocal_style && (
                      <span className="font-mono text-xs bg-steel px-2 py-1 text-bone">
                        {selectedChar.public_metadata.vocal_style}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload section */}
              <div className="card border-blood/30 p-6 mb-6">
                <div className="label mb-3">Subir imagen generada</div>
                <div className="flex items-center gap-4">
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
                    className="btn-primary flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>↑ {selectedChar.image_url ? 'Reemplazar imagen' : 'Subir imagen'}</>
                    )}
                  </button>
                  {uploadSuccess && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-mono text-xs text-blood"
                    >
                      ✓ Imagen guardada en Supabase
                    </motion.span>
                  )}
                  {selectedChar.image_url && (
                    <span className="font-mono text-xs text-smoke">
                      ✓ Tiene imagen
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-smoke/50 mt-2">
                  PNG/JPG · Se guarda en Supabase Storage y actualiza la colección automáticamente
                </p>
              </div>

              {/* Art Prompt section */}
              {!promptLoaded ? (
                <div className="border border-gold/30 bg-gold/5 p-6">
                  <div className="label text-gold mb-2">Prompts no cargados</div>
                  <p className="font-mono text-xs text-smoke mb-4">
                    Para ver el prompt de ComfyUI de este personaje, carga el archivo{' '}
                    <code className="text-bone">art_prompts.json</code> con el botón de arriba.
                  </p>
                  <p className="font-mono text-xs text-smoke/50">
                    Genera ese archivo corriendo:{' '}
                    <code className="text-bone">python generate_art_prompts.py</code>{' '}
                    en tu carpeta nft-music
                  </p>
                </div>
              ) : prompt ? (
                <div className="space-y-4">
                  {/* Archetype info */}
                  <div className="border border-steel p-4">
                    <div className="label mb-1">Arquetipo</div>
                    <div className="font-mono text-sm text-bone">{prompt.archetype}</div>
                  </div>

                  {/* Positive prompt */}
                  <div className="card border-ash/30 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="label">Positive Prompt (ComfyUI)</div>
                      <button
                        onClick={() => copyToClipboard(prompt.positive_prompt)}
                        className="font-mono text-xs text-smoke hover:text-bone transition-colors border border-ash/40 hover:border-bone px-3 py-1"
                      >
                        {copySuccess ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <div className="bg-iron p-4 border border-ash/20">
                      <p className="font-mono text-xs text-silver leading-relaxed break-words">
                        {prompt.positive_prompt}
                      </p>
                    </div>
                  </div>

                  {/* Negative prompt */}
                  <div className="card border-ash/30 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="label">Negative Prompt (ComfyUI)</div>
                      <button
                        onClick={() => copyToClipboard(NEGATIVE_PROMPT)}
                        className="font-mono text-xs text-smoke hover:text-bone transition-colors border border-ash/40 hover:border-bone px-3 py-1"
                      >
                        Copiar
                      </button>
                    </div>
                    <div className="bg-iron p-4 border border-ash/20">
                      <p className="font-mono text-xs text-silver/60 leading-relaxed break-words">
                        {NEGATIVE_PROMPT}
                      </p>
                    </div>
                  </div>

                  {/* ComfyUI settings reminder */}
                  <div className="border border-steel/50 p-4 bg-iron/30">
                    <div className="label mb-2">Configuración ComfyUI</div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs text-smoke">
                      <span>Modelo: <span className="text-bone">waiIllustriousSDXL_v150</span></span>
                      <span>LoRA 1: <span className="text-bone">afkArena (0.8)</span></span>
                      <span>LoRA 2: <span className="text-bone">hadesStyle (1.0)</span></span>
                      <span>LoRA 3: <span className="text-bone">Ultra_Style (0.8)</span></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-steel p-6">
                  <p className="font-mono text-xs text-smoke">
                    No se encontró prompt para <code className="text-bone">{selectedChar.id}</code> en el JSON cargado.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </main>
  )
}
