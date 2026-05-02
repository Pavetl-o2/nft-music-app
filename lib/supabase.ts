import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Character = {
  id: string
  name: string
  role: 'rhythm' | 'melody' | 'vocals'
  genre: string
  public_metadata: {
    role: string
    genre: string
    kit_type?: string
    instrument?: string
    vocal_style?: string
  }
  game_params: Record<string, unknown>
  rarity_score: number
}
