'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CharacterCard } from '@/components/CharacterCard'
import { SVGDefs, RoleGlyph, Tape, Scribble, PortraitPlaceholder } from '@/components/punk-primitives'
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
  const [progressSynced, setProgressSynced] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptsFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCharacters()
    loadDefaultPrompts()
  }, [])

  async function loadDefaultPrompts() {
    try {
      const res = await fetch('/art_prompts.json')
      if (res.ok) {
        const data = await res.json()
        setArtPrompts(data)
        setPromptsLoaded(true)
      }
    } catch {
      // prompts will be loaded manually if fetch fails
    }
  }

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

  const totals = useMemo(() => ({
    rhythm: characters.filter(r => r.role === 'rhythm').length,
    melody: characters.filter(r => r.role === 'melody').length,
    vocals: characters.filter(r => r.role === 'vocals').length,
  }), [characters])

  const total = totals.rhythm + totals.melody + totals.vocals
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

  async function compressImage(file: File, maxBytes = 3.5 * 1024 * 1024): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        // Scale down if needed so the longest side ≤ 1536px
        const MAX_DIM = 1536
        let { width, height } = img
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM }
          else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM }
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        // Try quality levels until under maxBytes
        let quality = 0.92
        const tryEncode = () => {
          canvas.toBlob(blob => {
            if (!blob) return reject(new Error('Canvas toBlob failed'))
            if (blob.size <= maxBytes || quality <= 0.5) return resolve(blob)
            quality -= 0.1
            tryEncode()
          }, 'image/jpeg', quality)
        }
        tryEncode()
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!detailChar) return
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadSuccess(false)

    let uploadBlob: Blob = file
    if (file.size > 3.5 * 1024 * 1024) {
      try { uploadBlob = await compressImage(file) } catch { /* use original */ }
    }

    const formData = new FormData()
    formData.append('file', new File([uploadBlob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
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

  const promptFor = (c: CharacterWithImage) => {
    const custom = getPrompt(c.id)
    if (custom) return { positive: custom.positive_prompt, negative: NEGATIVE_PROMPT }
    const trait = c.public_metadata.kit_type || c.public_metadata.instrument || c.public_metadata.vocal_style || ''
    const positive = `${c.role} character, ${c.genre} musician, ${trait}, punk zine portrait, halftone, photocopy texture, marker outline, high contrast, dramatic lighting`
    return { positive, negative: NEGATIVE_PROMPT }
  }

  const prompt = detailChar ? promptFor(detailChar) : null
  const bandList = ROLES.map(r => selected[r]).filter(Boolean) as CharacterWithImage[]

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <SVGDefs />

      {/* ══════ HEADER ══════ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--ink)',
          color: 'var(--paper)',
          borderBottom: '3px solid var(--paper)',
        }}
      >
        <div
          style={{
            maxWidth: 1480,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => router.push('/')}
              className="display"
              style={{
                fontSize: 32,
                lineHeight: 1,
                letterSpacing: '.02em',
                background: 'none',
                border: 'none',
                color: 'var(--paper)',
                cursor: 'pointer',
              }}
            >
              SOUND<span style={{ color: 'var(--accent)' }}>FORGE</span>
            </button>
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '.3em',
                color: 'var(--paper)',
                opacity: 0.65,
                paddingLeft: 10,
                borderLeft: '1px solid var(--paper)',
              }}
            >
              v0.3 &middot; 333 STEMS &middot; DEMO
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => { setAdminMode(v => !v); setDetailChar(null) }}
              className="chip"
              style={{
                background: adminMode ? 'var(--accent)' : 'transparent',
                color: 'var(--paper)',
                borderColor: 'var(--paper)',
                padding: '8px 12px',
                fontSize: 10,
              }}
            >
              {adminMode ? '\u25C9 ADMIN ON' : '\u25CB ADMIN'}
            </button>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '.2em',
                padding: '8px 12px',
                border: '1px solid var(--paper)',
                opacity: 0.6,
                color: 'var(--paper)',
              }}
            >
              0xDEMO...CAFE
            </div>
          </div>
        </div>
        {/* riot tape strip */}
        <div className="diag-stripes" style={{ height: 12, opacity: 0.65 }} />
      </header>

      {/* ══════ MAIN GRID ══════ */}
      <div
        style={{
          maxWidth: 1480,
          margin: '0 auto',
          padding: '28px 24px 80px',
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 300px) 1fr',
          gap: 28,
          alignItems: 'flex-start',
        }}
      >
        {/* ══════ SIDEBAR ══════ */}
        <aside style={{ position: 'sticky', top: 110, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!adminMode ? (
            <>
              {/* BAND */}
              <div className="paper-card" style={{ padding: 20, position: 'relative' }}>
                <Tape rotate={-3} text="BAND ROSTER" style={{ top: -14, left: 14, width: 160, height: 22 }} />
                <div className="display" style={{ fontSize: 30, lineHeight: 1, marginTop: 8 }}>
                  YOUR <span className="scribble-under">BAND</span>
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--pencil)', marginTop: 6 }}
                >
                  PICK 3 STEMS &middot; {bandList.length}/3
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                  {ROLES.map(role => (
                    <BandSlot
                      key={role}
                      role={role}
                      char={selected[role]}
                      onClear={() => setSelected(p => ({ ...p, [role]: null }))}
                      onJump={() => setActiveRole(role)}
                      isActive={activeRole === role}
                    />
                  ))}
                </div>

                <button
                  className="btn-punk btn-punk-primary"
                  onClick={handleFuse}
                  disabled={!allSelected}
                  style={{ width: '100%', marginTop: 18, fontSize: 22, padding: '14px 12px' }}
                >
                  ⚡ FORGE SONG
                </button>
                {!allSelected && (
                  <div
                    className="font-mono"
                    style={{
                      textAlign: 'center',
                      fontSize: 10,
                      color: 'var(--pencil)',
                      marginTop: 8,
                      letterSpacing: '.15em',
                    }}
                  >
                    [LOCKED &middot; NEED 3 STEMS]
                  </div>
                )}
              </div>

              {/* howto card */}
              <div className="paper-card" style={{ padding: 16, background: 'var(--ink)', color: 'var(--paper)' }}>
                <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.25em' }}>HOWTO</div>
                <div className="font-body" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8, opacity: 0.85 }}>
                  Pick one rhythm, one melody, one voice. Hit the big red. Eat the result.
                </div>
              </div>
            </>
          ) : (
            <AdminSidebar
              total={total}
              withImage={withImage}
              progressSynced={progressSynced}
              promptsLoaded={promptsLoaded}
              setProgressSynced={setProgressSynced}
              onLoadPrompts={() => promptsFileRef.current?.click()}
              selected={detailChar}
            />
          )}
          {/* hidden file inputs */}
          <input
            ref={promptsFileRef}
            type="file"
            accept=".json"
            onChange={handleLoadPrompts}
            className="hidden"
            style={{ display: 'none' }}
          />
        </aside>

        {/* ══════ MAIN CONTENT ══════ */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Admin detail panel */}
          <AnimatePresence>
            {adminMode && detailChar && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <AdminDetail
                  char={detailChar}
                  image={detailChar.image_url || undefined}
                  uploading={uploading}
                  uploadSuccess={uploadSuccess}
                  fileInputRef={fileInputRef}
                  onUpload={handleUpload}
                  onCopy={copyText}
                  copiedPositive={copiedPositive}
                  copiedNegative={copiedNegative}
                  prompts={prompt!}
                  promptsLoaded={promptsLoaded}
                  onClose={() => setDetailChar(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* STATS BAR */}
          {!loading && (
            <div
              className="paper-card"
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              <StatPill label="RHYTHM" value={totals.rhythm} accent={!!selected.rhythm} />
              <StatPill label="MELODY" value={totals.melody} accent={!!selected.melody} />
              <StatPill label="VOCALS" value={totals.vocals} accent={!!selected.vocals} />
              <div style={{ flex: 1, minWidth: 20 }} />
              <div className="font-mono" style={{ fontSize: 11, letterSpacing: '.25em', color: 'var(--pencil)' }}>
                TOTAL
              </div>
              <div className="display" style={{ fontSize: 36, lineHeight: 1 }}>{total}</div>
            </div>
          )}

          {/* ROLE TABS */}
          <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => { setActiveRole(role); setFilter('all') }}
                className="display"
                style={{
                  flex: 1,
                  padding: '16px 18px',
                  background: activeRole === role ? 'var(--ink)' : 'var(--paper)',
                  color: activeRole === role ? 'var(--paper)' : 'var(--ink)',
                  border: '2px solid var(--ink)',
                  borderRight: 'none',
                  fontSize: 22,
                  letterSpacing: '.06em',
                  cursor: 'pointer',
                  position: 'relative',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <RoleGlyph
                  role={role}
                  size={28}
                  ink={activeRole === role ? 'var(--paper)' : 'var(--ink)'}
                  accent="var(--accent)"
                />
                {getRoleLabel(role)}
                <span
                  className="font-mono"
                  style={{ fontSize: 10, opacity: 0.7, marginLeft: 'auto', letterSpacing: '.2em' }}
                >
                  {totals[role as keyof typeof totals]}
                </span>
                {activeRole === role && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: -3,
                      height: 3,
                      background: 'var(--accent)',
                    }}
                  />
                )}
              </button>
            ))}
            {/* close right border */}
            <div style={{ position: 'absolute', right: -2, top: 0, bottom: 0, width: 2, background: 'var(--ink)' }} />
          </div>

          {/* GENRE FILTERS */}
          {!loading && (
            <div
              className="paper-card"
              style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <div
                className="font-mono"
                style={{ fontSize: 10, letterSpacing: '.3em', color: 'var(--pencil)', marginRight: 6 }}
              >
                GENRE /
              </div>
              {genres.map(g => (
                <button
                  key={g}
                  onClick={() => setFilter(g)}
                  className={`chip chip-accent ${filter === g ? 'chip-on' : ''}`}
                >
                  {g === 'all' ? 'ALL' : g.toUpperCase().replace('_', ' ')}
                </button>
              ))}
              <div style={{ flex: 1, minWidth: 20 }} />
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--pencil)' }}>
                SHOWING {filtered.length}/{totals[activeRole as keyof typeof totals]}
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="paper-card" style={{ padding: 60, textAlign: 'center' }}>
              <div className="display" style={{ fontSize: 28 }}>LOADING...</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 16 }}>
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{
                      width: 4,
                      height: 20 + Math.sin(i * 0.8) * 12,
                      background: 'var(--ink)',
                    }}
                  />
                ))}
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--pencil)', marginTop: 12, letterSpacing: '.2em' }}>
                FETCHING STEMS FROM SUPABASE...
              </div>
            </div>
          )}

          {/* GRID */}
          {!loading && (
            <motion.div
              layout
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 22,
                paddingTop: 8,
              }}
            >
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
                      selected={
                        adminMode
                          ? detailChar?.id === char.id
                          : selected[char.role]?.id === char.id
                      }
                      hasImage={!!char.image_url}
                      adminMode={adminMode}
                      onClick={() => handleSelect(char)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="paper-card" style={{ padding: 40, textAlign: 'center' }}>
              <div className="display" style={{ fontSize: 36 }}>NOTHING HERE.</div>
              <div className="font-body" style={{ fontSize: 14, marginTop: 8, color: 'var(--pencil)' }}>
                Try another genre, or another role.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════ */

function StatPill({ label, value, accent }: { label: string; value: number; accent: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginRight: 18 }}>
      <div
        className="font-mono"
        style={{ fontSize: 10, letterSpacing: '.25em', color: accent ? 'var(--accent)' : 'var(--pencil)' }}
      >
        {label}
      </div>
      <div
        className="display"
        style={{ fontSize: 30, lineHeight: 1, color: accent ? 'var(--accent)' : 'var(--ink)' }}
      >
        {value}
      </div>
    </div>
  )
}

function BandSlot({
  role,
  char,
  onClear,
  onJump,
  isActive,
}: {
  role: string
  char: CharacterWithImage | null
  onClear: () => void
  onJump: () => void
  isActive: boolean
}) {
  const label = getRoleLabel(role)
  if (!char) {
    return (
      <button
        onClick={onJump}
        style={{
          padding: '10px 12px',
          textAlign: 'left',
          cursor: 'pointer',
          background: isActive ? 'var(--paper-2)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '2px dashed var(--ink)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '2px dashed var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RoleGlyph role={role} size={26} />
        </div>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--pencil)' }}>
            SLOT &middot; {label}
          </div>
          <div className="display" style={{ fontSize: 18, lineHeight: 1, color: 'var(--pencil)' }}>EMPTY</div>
        </div>
      </button>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: 'var(--ink)',
        color: 'var(--paper)',
        border: '2px solid var(--ink)',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          background: 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--paper)',
        }}
      >
        <RoleGlyph role={role} size={28} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-mono" style={{ fontSize: 9, letterSpacing: '.25em', color: 'var(--accent)' }}>
          {label} &middot; {char.genre?.toUpperCase()}
        </div>
        <div
          className="display"
          style={{
            fontSize: 18,
            lineHeight: 1,
            color: 'var(--paper)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {char.name}
        </div>
      </div>
      <button
        onClick={onClear}
        className="font-mono"
        style={{
          background: 'transparent',
          color: 'var(--paper)',
          border: '1px solid var(--paper)',
          padding: '4px 6px',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )
}

function AdminSidebar({
  total,
  withImage,
  progressSynced,
  promptsLoaded,
  setProgressSynced,
  onLoadPrompts,
  selected,
}: {
  total: number
  withImage: number
  progressSynced: boolean
  promptsLoaded: boolean
  setProgressSynced: (v: boolean) => void
  onLoadPrompts: () => void
  selected: CharacterWithImage | null
}) {
  const pct = total ? (withImage / total) * 100 : 0
  return (
    <>
      <div className="paper-card" style={{ padding: 18, background: 'var(--accent)', color: 'var(--paper)' }}>
        <Tape rotate={-2} text="ADMIN MODE" style={{ top: -14, left: 14, width: 140, height: 22 }} variant="green" />
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.25em', marginTop: 4 }}>ART PROGRESS</div>
        <div className="display" style={{ fontSize: 38, lineHeight: 1, marginTop: 4 }}>
          {withImage}<span style={{ opacity: 0.6, fontSize: 22 }}>/{total}</span>
        </div>
        <div
          style={{
            height: 12,
            border: '2px solid var(--paper)',
            marginTop: 10,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--paper)' }} />
        </div>
        <div className="font-mono" style={{ fontSize: 9, letterSpacing: '.2em', marginTop: 6, opacity: 0.85 }}>
          {pct.toFixed(1)}% COMPLETE &middot; {total - withImage} TO GO
        </div>
      </div>

      <div className="paper-card" style={{ padding: 16 }}>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.25em', color: 'var(--pencil)' }}>TOOLS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <button className="btn-punk" onClick={onLoadPrompts} style={{ fontSize: 13, padding: '10px 12px' }}>
            {promptsLoaded ? '\u2713 PROMPTS LOADED' : '\u2913 LOAD art_prompts.json'}
          </button>
          <button
            className="btn-punk"
            onClick={() => setProgressSynced(!progressSynced)}
            style={{ fontSize: 13, padding: '10px 12px' }}
          >
            {progressSynced ? '\u2713 PROGRESS SYNCED' : '\u21BB SYNC PROGRESS'}
          </button>
        </div>
      </div>

      <div className="paper-card" style={{ padding: 16, minHeight: 100 }}>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.25em', color: 'var(--pencil)' }}>SELECTED</div>
        {selected ? (
          <>
            <div className="display" style={{ fontSize: 22, lineHeight: 1, marginTop: 6 }}>{selected.name}</div>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--pencil)', marginTop: 4 }}>
              {getRoleLabel(selected.role)} &middot; {formatGenre(selected.genre)} &middot;{' '}
              {selected.public_metadata.kit_type || selected.public_metadata.instrument || selected.public_metadata.vocal_style || ''}
            </div>
            <div className="font-mono" style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--pencil)', marginTop: 4 }}>
              ID/{selected.id}
            </div>
          </>
        ) : (
          <div className="font-body" style={{ fontSize: 12, color: 'var(--pencil)', marginTop: 6 }}>
            Click a card to inspect it.
          </div>
        )}
      </div>
    </>
  )
}

function AdminDetail({
  char,
  image,
  uploading,
  uploadSuccess,
  fileInputRef,
  onUpload,
  onCopy,
  copiedPositive,
  copiedNegative,
  prompts,
  promptsLoaded,
  onClose,
}: {
  char: CharacterWithImage
  image?: string
  uploading: boolean
  uploadSuccess: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCopy: (text: string, type: 'positive' | 'negative') => void
  copiedPositive: boolean
  copiedNegative: boolean
  prompts: { positive: string; negative: string }
  promptsLoaded: boolean
  onClose: () => void
}) {
  return (
    <div
      className="paper-card"
      style={{ padding: 22, position: 'relative', borderColor: 'var(--accent)', borderWidth: 3 }}
    >
      <div className="sticker" style={{ top: -16, left: 22, transform: 'rotate(-3deg)' }}>EDIT MODE</div>
      <button
        onClick={onClose}
        className="btn-punk btn-punk-ghost"
        style={{ position: 'absolute', top: 12, right: 12, padding: '6px 10px', fontSize: 12 }}
      >
        ✕
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 22, alignItems: 'flex-start' }}>
        {/* image preview */}
        <div style={{ width: 200 }}>
          <div
            style={{
              width: 200,
              height: 200,
              border: '2px solid var(--ink)',
              background: 'var(--paper-2)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {image ? (
              <>
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {uploadSuccess && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255,34,48,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: 'var(--paper)', fontSize: 32 }}>{'\u2713'}</span>
                  </div>
                )}
              </>
            ) : (
              <PortraitPlaceholder char={char} size="lg" />
            )}
          </div>
          <label
            className="btn-punk"
            style={{ display: 'block', textAlign: 'center', marginTop: 10, fontSize: 13, cursor: 'pointer' }}
          >
            {uploading ? '\u21BB UPLOADING...' : image ? '\u21BB REPLACE' : '\u2913 UPLOAD'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.25em', color: 'var(--pencil)' }}>
              ID/{char.id}
            </div>
            <div className="display" style={{ fontSize: 36, lineHeight: 1, marginTop: 4 }}>{char.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="chip chip-on">{getRoleLabel(char.role)}</span>
              <span className="chip">{formatGenre(char.genre)}</span>
              <span className="chip">
                {char.public_metadata.kit_type || char.public_metadata.instrument || char.public_metadata.vocal_style || ''}
              </span>
              <span className="chip">R{char.rarity_score}</span>
            </div>
          </div>

          {/* Prompts */}
          <PromptBlock
            label="POSITIVE"
            text={prompts.positive}
            onCopy={() => onCopy(prompts.positive, 'positive')}
            copied={copiedPositive}
            variant="ink"
          />
          <PromptBlock
            label="NEGATIVE"
            text={prompts.negative}
            onCopy={() => onCopy(prompts.negative, 'negative')}
            copied={copiedNegative}
            variant="paper"
          />
        </div>
      </div>
    </div>
  )
}

function PromptBlock({
  label,
  text,
  onCopy,
  copied,
  variant,
}: {
  label: string
  text: string
  onCopy: () => void
  copied: boolean
  variant: 'ink' | 'paper'
}) {
  const dark = variant === 'ink'
  return (
    <div
      style={{
        border: '2px solid var(--ink)',
        background: dark ? 'var(--ink)' : 'var(--paper-2)',
        color: dark ? 'var(--paper)' : 'var(--ink)',
        padding: 12,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.3em', opacity: 0.8 }}>{label}</div>
        <button
          onClick={onCopy}
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '.2em',
            background: copied ? 'var(--accent)' : (dark ? 'var(--paper)' : 'var(--ink)'),
            color: copied ? 'var(--paper)' : (dark ? 'var(--ink)' : 'var(--paper)'),
            border: 'none',
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          {copied ? '\u2713 COPIED' : 'COPY'}
        </button>
      </div>
      <div className="font-body" style={{ fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>
        {text}
      </div>
    </div>
  )
}
