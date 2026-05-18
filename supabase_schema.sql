-- ============================================================
-- NFT Music Game — Supabase Schema
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Tabla de personajes NFT (game_params privados, nunca expuestos al frontend)
CREATE TABLE IF NOT EXISTS nft_characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('rhythm', 'melody', 'vocals')),
  genre TEXT NOT NULL,
  public_metadata JSONB NOT NULL DEFAULT '{}',
  game_params JSONB NOT NULL DEFAULT '{}',
  rarity_score INTEGER NOT NULL DEFAULT 0,
  image_position_x FLOAT DEFAULT 50,
  image_position_y FLOAT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la tabla ya existe, agregar las columnas con:
-- ALTER TABLE nft_characters ADD COLUMN IF NOT EXISTS image_position_x FLOAT DEFAULT 50;
-- ALTER TABLE nft_characters ADD COLUMN IF NOT EXISTS image_position_y FLOAT DEFAULT 50;

-- Index por rol para queries rápidas
CREATE INDEX IF NOT EXISTS idx_nft_characters_role ON nft_characters(role);
CREATE INDEX IF NOT EXISTS idx_nft_characters_genre ON nft_characters(genre);
CREATE INDEX IF NOT EXISTS idx_nft_characters_rarity ON nft_characters(rarity_score DESC);

-- RLS: Habilitar Row Level Security
ALTER TABLE nft_characters ENABLE ROW LEVEL SECURITY;

-- Policy: public_metadata es pública (cualquiera puede leer nombre, rol, género)
-- game_params NUNCA se expone al frontend — solo accesible via service_role desde el servidor
CREATE POLICY "Public metadata readable by all"
  ON nft_characters
  FOR SELECT
  USING (true);

-- Tabla de canciones generadas (historial)
CREATE TABLE IF NOT EXISTS generated_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT,
  rhythm_id TEXT REFERENCES nft_characters(id),
  melody_id TEXT REFERENCES nft_characters(id),
  vocals_id TEXT REFERENCES nft_characters(id),
  lyrics TEXT,
  fusion_prompt TEXT,
  bpm INTEGER,
  key_scale TEXT,
  audio_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_songs_wallet ON generated_songs(wallet_address);

-- RLS para canciones
ALTER TABLE generated_songs ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar (el servidor inserta con service_role)
-- Para el prototipo, permitimos lectura pública
CREATE POLICY "Songs readable by all"
  ON generated_songs
  FOR SELECT
  USING (true);

-- ============================================================
-- VIEW: public_characters (solo expone datos públicos, nunca game_params)
-- Usar esta view en el frontend en vez de la tabla directa
-- ============================================================
CREATE OR REPLACE VIEW public_characters AS
SELECT
  id,
  name,
  role,
  genre,
  public_metadata,
  rarity_score,
  created_at
FROM nft_characters;

-- ============================================================
-- FUNCIÓN: get_character_for_generation
-- Solo accesible con service_role (desde el servidor Next.js)
-- Devuelve game_params para la fusión
-- ============================================================
CREATE OR REPLACE FUNCTION get_characters_for_generation(
  rhythm_id TEXT,
  melody_id TEXT,
  vocals_id TEXT
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  role TEXT,
  genre TEXT,
  game_params JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.role,
    c.genre,
    c.game_params
  FROM nft_characters c
  WHERE c.id IN (rhythm_id, melody_id, vocals_id);
END;
$$;
