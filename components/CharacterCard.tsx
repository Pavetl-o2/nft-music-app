'use client'

import { cn, formatGenre } from '@/lib/utils'
import type { Character } from '@/lib/supabase'
import { RoleGlyph, PortraitPlaceholder, Tape } from './punk-primitives'

interface CharacterCardProps {
  character: Character & { image_url?: string | null }
  selected?: boolean
  onClick?: () => void
  compact?: boolean
  adminMode?: boolean
  hasImage?: boolean
  imagePosition?: { x: number; y: number }
}

const TAPE_VARIANTS: Record<string, 'yellow' | 'green'> = {
  rhythm: 'yellow',
  melody: 'yellow',
  vocals: 'green',
}

export function CharacterCard({ character, selected, onClick, compact, adminMode, hasImage, imagePosition }: CharacterCardProps) {
  const trait = character.public_metadata.kit_type
    || character.public_metadata.instrument
    || character.public_metadata.vocal_style
    || ''

  // pseudo-stable seed from id for per-card visual variation
  const seed = character.id.charCodeAt(character.id.length - 1) + character.id.charCodeAt(0)
  const tilt = ((seed % 7) - 3) * 0.25
  const tapeRot = ((seed % 5) - 2) * 1.4
  const stickerRot = ((seed % 9) - 4) * 0.8

  const roleLabel = character.public_metadata.role || character.role.toUpperCase()
  const num = character.id.split('_').pop()?.replace(/\D/g, '').padStart(3, '0') || '000'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('paper-card no-select text-left w-full', compact ? 'p-3' : 'p-[14px]')}
      style={{
        cursor: 'pointer',
        transform: `rotate(${tilt}deg)`,
        transition: 'transform .15s ease, box-shadow .15s ease',
        boxShadow: selected
          ? `6px 6px 0 0 var(--accent), 6px 6px 0 2px var(--ink)`
          : '4px 4px 0 0 var(--ink)',
        outline: selected ? '2px solid var(--ink)' : 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `rotate(${tilt}deg) translate(-2px, -2px)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${tilt}deg)`
      }}
    >
      {/* portrait */}
      {!compact && (
        <div style={{ position: 'relative' }}>
          {character.image_url ? (
            <div
              style={{
                width: '100%',
                height: 160,
                border: '2px solid var(--ink)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <img
                src={character.image_url}
                alt={character.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: imagePosition ? `${imagePosition.x}% ${imagePosition.y}%` : '50% 50%',
                }}
              />
              <div className="scanlines" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
            </div>
          ) : (
            <PortraitPlaceholder char={{ ...character, num }} />
          )}
          {/* tape label on portrait */}
          <Tape
            rotate={tapeRot}
            variant={TAPE_VARIANTS[character.role] || 'yellow'}
            text={roleLabel}
            style={{ top: -10, left: 16, width: 110, height: 22 }}
          />
          {/* admin status tick */}
          {adminMode && (
            <div
              className="font-mono"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: hasImage ? 'var(--ink)' : 'var(--paper)',
                color: hasImage ? 'var(--paper)' : 'var(--ink)',
                border: '2px solid var(--ink)',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {hasImage ? '\u2713' : '\u25CB'}
            </div>
          )}
        </div>
      )}

      {/* meta block */}
      <div style={{ marginTop: compact ? 0 : 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--pencil)' }}>
            № {num}
          </div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--ink)' }}>
            R{character.rarity_score}
          </div>
        </div>

        <div
          className="display"
          style={{ fontSize: compact ? 20 : 28, lineHeight: 0.95, color: 'var(--ink)', wordBreak: 'break-word' }}
        >
          {character.name}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          <span className="chip" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            {formatGenre(character.genre)}
          </span>
          {trait && <span className="chip">{trait}</span>}
        </div>
      </div>

      {/* selected sticker */}
      {selected && !adminMode && (
        <div
          className="sticker"
          style={{
            top: -14,
            right: -10,
            transform: `rotate(${stickerRot + 6}deg)`,
            fontSize: 14,
            padding: '6px 12px',
          }}
        >
          ✶ PICKED
        </div>
      )}
    </button>
  )
}
