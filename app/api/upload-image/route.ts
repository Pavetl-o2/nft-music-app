import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const characterId = formData.get('characterId') as string

    if (!file || !characterId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const ext = file.name.split('.').pop() || 'png'
    const filePath = `${characterId}.${ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('character-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('character-images')
      .getPublicUrl(filePath)

    const imageUrl = urlData.publicUrl

    const { error: updateError } = await supabaseAdmin
      .from('nft_characters')
      .update({ image_url: imageUrl })
      .eq('id', characterId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, imageUrl })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
