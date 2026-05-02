'use client'

import { motion } from 'framer-motion'
import { cn, formatGenre } from '@/lib/utils'
import type { Character } from '@/lib/supabase'

interface CharacterCardProps {
  character: Character
  selected?: boolean
  onClick?: () => void
  compact?: boolean
}

const ROLE_COLORS = {
  rhythm: 'border-amber/40 hover:border-amber',
  melody: 'border-blood/40 hover:border-blood',
  vocals: 'border-silver/40 hover:border-silver',
}

const ROLE_ACCENT = {
  rhythm: 'text-amber',
  melody: 'text-blood',
  vocals: 'text-silver',
}

const ROLE_ICONS = {
  rhythm: '🥁',
  melody: '🎸',
  vocals: '🎤',
}

export function CharacterCard({ character, selected, onClick, compact }: CharacterCardProps) {
  const trait = character.public_metadata.kit_type 
    || character.public_metadata.instrument 
    || character.public_metadata.vocal_style 
    || ''

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'card cursor-pointer transition-all duration-200 border',
        ROLE_COLORS[character.role],
        selected && 'border-blood shadow-[0_0_20px_rgba(204,34,0,0.3)]',
        compact ? 'p-3' : 'p-5'
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blood" />
      )}

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{ROLE_ICONS[character.role]}</span>
          <div>
            <span className={cn('label text-[10px]', ROLE_ACCENT[character.role])}>
              {character.public_metadata.role}
            </span>
          </div>
        </div>
        {selected && (
          <div className="w-5 h-5 bg-blood flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        )}
      </div>

      {/* Character art placeholder */}
      {!compact && (
        <div className="h-32 mb-3 bg-steel/30 flex items-center justify-center border border-ash/20 relative overflow-hidden">
          {/* Placeholder silhouette */}
          <div className="text-5xl opacity-20">♪</div>
          {/* Scanline overlay */}
          <div className="absolute inset-0 scanline opacity-30" />
        </div>
      )}

      {/* Name */}
      <h3 className={cn(
        'font-display tracking-wider leading-none',
        compact ? 'text-lg' : 'text-2xl'
      )}>
        {character.name}
      </h3>

      {/* Genre + Trait */}
      <div className={cn('flex gap-2 flex-wrap', compact ? 'mt-1' : 'mt-2')}>
        <span className="font-mono text-xs bg-steel px-2 py-0.5 text-bone">
          {formatGenre(character.genre)}
        </span>
        {trait && (
          <span className="font-mono text-xs bg-iron px-2 py-0.5 text-smoke border border-ash/30">
            {trait}
          </span>
        )}
      </div>
    </motion.div>
  )
}
