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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 })
    }

    // Convert to buffer
    const buffer = await file.arrayBuffer()
    const ext = file.name.split('.').pop() || 'png'
    const filePath = `${characterId}.${ext}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('character-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true, // overwrite if exists
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('character-images')
      .getPublicUrl(filePath)

    const imageUrl = urlData.publicUrl

    // Update character in database
    const { error: updateError } = await supabaseAdmin
      .from('nft_characters')
      .update({ image_url: imageUrl })
      .eq('id', characterId)

    if (updateError) {
      console.error('DB update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, imageUrl })

  } catch (error: any) {
    console.error('Upload route error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
