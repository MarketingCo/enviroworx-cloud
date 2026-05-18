export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseEnviroworxKml } from '@/lib/kml-parser'
import { supabaseAdmin } from '@/lib/supabase'
import { requireOfficeAuth } from '@/lib/auth'
import path from 'path'

export async function POST(req: NextRequest) {
  const user = await requireOfficeAuth(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized - office login required' }, { status: 401 })
  }

  try {
    const kmlPath = path.resolve(process.cwd(), 'Enviroworx (3).kml')
    const points = await parseEnviroworxKml(kmlPath)
    
    if (points.length === 0) {
      return NextResponse.json({ success: false, error: 'No points found in KML file' })
    }

    // Clear existing points
    await supabaseAdmin.from('external_map_points').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Bulk insert
    const { error } = await supabaseAdmin.from('external_map_points').insert(
      points.map(p => ({
        name: p.name,
        description: p.description,
        latitude: p.latitude,
        longitude: p.longitude,
        folder: p.folder,
        style_url: p.styleUrl
      }))
    )

    if (error) throw error

    return NextResponse.json({ success: true, count: points.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('KML Sync Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
