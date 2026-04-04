import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'
import path from 'path'

export interface KmlPoint {
  name: string
  description?: string
  latitude: number
  longitude: number
  folder: string
  styleUrl?: string
}

export async function parseEnviroworxKml(filePath: string): Promise<KmlPoint[]> {
  try {
    const kmlContent = fs.readFileSync(filePath, 'utf-8')
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    })
    
    const jsonObj = parser.parse(kmlContent)
    const folders = jsonObj.kml?.Document?.Folder
    
    if (!folders) return []

    const points: KmlPoint[] = []
    
    // Normalize to array if single folder
    const folderList = Array.isArray(folders) ? folders : [folders]

    for (const folder of folderList) {
      const folderName = folder.name || 'Unknown'
      const placemarks = folder.Placemark
      
      if (!placemarks) continue
      
      const placemarkList = Array.isArray(placemarks) ? placemarks : [placemarks]
      
      for (const pm of placemarkList) {
        const coords = pm.Point?.coordinates?.split(',')
        if (coords && coords.length >= 2) {
          points.push({
            name: pm.name || 'No Name',
            description: pm.description || '',
            longitude: parseFloat(coords[0]),
            latitude: parseFloat(coords[1]),
            folder: folderName,
            styleUrl: pm.styleUrl
          })
        }
      }
    }

    return points
  } catch (error) {
    console.error('Failed to parse KML:', error)
    return []
  }
}
