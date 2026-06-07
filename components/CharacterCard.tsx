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
  onImageClick?: () => void
}

const TAPE_VARIANTS: Record<string, 'yellow' | 'green'> = {
  rhythm: 'yellow',
  melody: 'yellow',
  vocals: 'green',
}

const RARITY_LABEL: Record<number, string> = {}
function rarityTier(score: number) {
  if (score >= 95) return '★★★'
  if (score >= 80) return '★★☆'
  return '★☆☆'
}

export function CharacterCard({ character, selected, onClick, compact, adminMode, hasImage, imagePosition, onImageClick }: CharacterCardProps) {
  const trait = character.public_metadata.kit_type
    || character.public_metadata.instrument
    || character.public_metadata.vocal_style
    || ''

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
      className={cn('paper-card no-select text-left w-full', compact ? 'p-3' : 'p-[10px]')}
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
      {/* ── PORTRAIT ── */}
      {!compact && (
        <div style={{ position: 'relative' }}>

          {/* image or placeholder */}
          {character.image_url ? (
            <div
              role={onImageClick ? 'button' : undefined}
              tabIndex={onImageClick ? 0 : undefined}
              onClick={onImageClick ? (e) => { e.stopPropagation(); onImageClick() } : undefined}
              onKeyDown={onImageClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onImageClick() } } : undefined}
              style={{
                width: '100%',
                height: 280,
                border: '2px solid var(--ink)',
                overflow: 'hidden',
                position: 'relative',
                cursor: onImageClick ? 'zoom-in' : undefined,
              }}
            >
              <img
                src={character.image_url}
                alt={character.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: imagePosition ? `${imagePosition.x}% ${imagePosition.y}%` : '50% 20%',
                }}
              />
              <div className="scanlines" style={{ position: 'absolute', inset: 0, opacity: 0.25 }} />
            </div>
          ) : (
            /* placeholder wrapped to portrait height */
            <div style={{ width: '100%', height: 280, border: '2px solid var(--ink)', overflow: 'hidden', position: 'relative', background: 'var(--paper-2)' }}>
              <PortraitPlaceholder char={{ ...character, num }} size="lg" />
            </div>
          )}

          {/* ── ROLE BADGE — extruded square, top-right corner ── */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 36,
              height: 36,
              background: 'var(--paper)',
              border: '2px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <RoleGlyph role={character.role} size={22} ink="var(--ink)" accent="var(--accent)" />
          </div>

          {/* tape label — bottom-left so no clash with badge */}
          <Tape
            rotate={tapeRot}
            variant={TAPE_VARIANTS[character.role] || 'yellow'}
            text={roleLabel}
            style={{ bottom: -10, left: 12, width: 100, height: 20 }}
          />

          {/* admin status tick */}
          {adminMode && (
            <div
              className="font-mono"
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                background: hasImage ? 'var(--ink)' : 'var(--paper)',
                color: hasImage ? 'var(--paper)' : 'var(--ink)',
                border: '2px solid var(--ink)',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                zIndex: 3,
              }}
            >
              {hasImage ? '✓' : '○'}
            </div>
          )}
        </div>
      )}

      {/* ── CARD STATS BLOCK ── */}
      <div style={{ marginTop: compact ? 0 : 14, display: 'flex', flexDirection: 'column', gap: 5 }}>

        {/* collector line: number + rarity tier */}
        {!compact && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="font-mono" style={{ fontSize: 8, letterSpacing: '.25em', color: 'var(--pencil)' }}>
              № {num}
            </div>
            <div className="font-mono" style={{ fontSize: 9, letterSpacing: '.05em', color: 'var(--ink)' }}>
              {rarityTier(character.rarity_score)}
            </div>
          </div>
        )}

        {/* name */}
        <div
          className="display"
          style={{ fontSize: compact ? 20 : 24, lineHeight: 0.95, color: 'var(--ink)', wordBreak: 'break-word' }}
        >
          {character.name}
        </div>

        {/* type line: genre + trait */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          <span className="chip" style={{ background: 'var(--ink)', color: 'var(--paper)', fontSize: 9, padding: '2px 7px' }}>
            {formatGenre(character.genre)}
          </span>
          {trait && (
            <span className="chip" style={{ fontSize: 9, padding: '2px 7px' }}>
              {trait}
            </span>
          )}
        </div>

        {/* power/rarity score — bottom stat line like TCG */}
        {!compact && (
          <div
            className="font-mono"
            style={{
              fontSize: 8,
              letterSpacing: '.2em',
              color: 'var(--pencil)',
              marginTop: 2,
              borderTop: '1px solid var(--ink)',
              paddingTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>PWR {character.rarity_score}</span>
            <span>{character.role.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* ── PICKED sticker ── */}
      {selected && !adminMode && (
        <div
          className="sticker"
          style={{
            top: -16,
            right: -12,
            transform: `rotate(${stickerRot + 6}deg)`,
            fontSize: 13,
            padding: '6px 12px',
          }}
        >
          ✶ PICKED
        </div>
      )}
    </button>
  )
}
