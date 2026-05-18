import { parseEnviroworxKml } from '../lib/kml-parser.js'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role for bulk inserts

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing from .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runImport() {
  const kmlPath = path.resolve(process.cwd(), 'Enviroworx (3).kml')
  console.log(`Parsing KML: ${kmlPath}...`)
  
  const points = await parseEnviroworxKml(kmlPath)
  console.log(`Found ${points.length} points. Importing to Supabase...`)

  // Clear existing points first (optional, or use upsert)
  const { error: deleteError } = await supabase.from('external_map_points').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteError) {
    console.error('Failed to clear old points:', deleteError)
  }

  const batchSize = 100
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize).map(p => ({
      name: p.name,
      description: p.description,
      latitude: p.latitude,
      longitude: p.longitude,
      folder: p.folder,
      style_url: p.styleUrl
    }))

    const { error } = await supabase.from('external_map_points').insert(batch)
    if (error) {
      console.error(`Error importing batch ${i}:`, error)
    } else {
      console.log(`Imported batch ${i / batchSize + 1}`)
    }
  }

  console.log('Import complete!')
}

runImport()
