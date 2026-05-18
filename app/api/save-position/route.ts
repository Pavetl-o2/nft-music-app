import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { characterId, x, y } = await req.json()

    if (!characterId || x === undefined || y === undefined) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('nft_characters')
      .update({ image_position_x: x, image_position_y: y })
      .eq('id', characterId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
