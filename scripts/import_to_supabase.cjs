// ============================================================
// Script para importar los 333 personajes a Supabase
// Uso: node scripts/import_to_supabase.cjs
//
// Requiere:
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en variables de entorno
//   o crear un archivo .env.local con esas variables
// ============================================================

const fs = require('fs')
const path = require('path')

// Cargar variables de entorno desde .env.local si existe
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...val] = line.split('=')
    if (key && val.length) process.env[key.trim()] = val.join('=').trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables de entorno:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nCrea un archivo .env.local en la raíz del proyecto con esas variables.')
  process.exit(1)
}

async function importCharacters() {
  const charactersPath = path.join(__dirname, '..', 'characters.json')
  
  if (!fs.existsSync(charactersPath)) {
    console.error('❌ No se encontró characters.json')
    console.error('   Primero corre: node generate_characters.cjs')
    process.exit(1)
  }

  const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'))
  console.log(`📦 Importando ${characters.length} personajes a Supabase...`)

  // Import in batches of 50
  const batchSize = 50
  let imported = 0
  let errors = 0

  for (let i = 0; i < characters.length; i += batchSize) {
    const batch = characters.slice(i, i + batchSize)
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/nft_characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`❌ Batch ${i}-${i+batchSize} failed:`, err)
      errors += batch.length
    } else {
      imported += batch.length
      console.log(`  ✓ ${imported}/${characters.length} importados`)
    }
  }

  console.log(`\n=== IMPORTACIÓN COMPLETA ===`)
  console.log(`✅ Importados: ${imported}`)
  if (errors > 0) console.log(`❌ Errores: ${errors}`)
}

importCharacters().catch(console.error)
