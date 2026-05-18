import { describe, it, expect, vi } from 'vitest'
import { parseEnviroworxKml } from './kml-parser'
import fs from 'fs'

// Mock fs module
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}))

describe('parseEnviroworxKml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses a simple KML with a single Placemark in a Folder', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Test Folder</name>
      <Placemark>
        <name>Test Point</name>
        <description>A test point</description>
        <Point>
          <coordinates>-3.1883,55.9533,0</coordinates>
        </Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toHaveLength(1)
    expect(points[0].name).toBe('Test Point')
    expect(points[0].description).toBe('A test point')
    expect(points[0].latitude).toBe(55.9533)
    expect(points[0].longitude).toBe(-3.1883)
    expect(points[0].folder).toBe('Test Folder')
  })

  it('handles multiple Placemarks in a single Folder', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Edinburgh</name>
      <Placemark>
        <name>Point A</name>
        <Point><coordinates>-3.0,56.0,0</coordinates></Point>
      </Placemark>
      <Placemark>
        <name>Point B</name>
        <Point><coordinates>-4.0,57.0,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toHaveLength(2)
    expect(points[0].name).toBe('Point A')
    expect(points[0].latitude).toBe(56.0)
    expect(points[0].longitude).toBe(-3.0)
    expect(points[1].name).toBe('Point B')
    expect(points[1].latitude).toBe(57.0)
    expect(points[1].longitude).toBe(-4.0)
  })

  it('handles multiple Folders', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Folder A</name>
      <Placemark>
        <name>In A</name>
        <Point><coordinates>-1.0,51.0,0</coordinates></Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>Folder B</name>
      <Placemark>
        <name>In B</name>
        <Point><coordinates>-2.0,52.0,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toHaveLength(2)
    expect(points[0].folder).toBe('Folder A')
    expect(points[1].folder).toBe('Folder B')
  })

  it('returns empty array for invalid KML content', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('not valid xml at all')

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toEqual([])
  })

  it('returns empty array when KML has no Folders', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>No Folders Here</name>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toEqual([])
  })

  it('returns empty array when Folder has no Placemarks', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Empty Folder</name>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toEqual([])
  })

  it('skips Placemarks without Point coordinates', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Mixed</name>
      <Placemark>
        <name>Has Coords</name>
        <Point><coordinates>-3.0,56.0,0</coordinates></Point>
      </Placemark>
      <Placemark>
        <name>No Coords</name>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toHaveLength(1)
    expect(points[0].name).toBe('Has Coords')
  })

  it('uses "No Name" for Placemark without name', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Test</name>
      <Placemark>
        <Point><coordinates>-3.0,56.0,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points).toHaveLength(1)
    expect(points[0].name).toBe('No Name')
  })

  it('captures styleUrl when present', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Styled</name>
      <Placemark>
        <name>Styled Point</name>
        <styleUrl>#icon-123</styleUrl>
        <Point><coordinates>-3.0,56.0,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points[0].styleUrl).toBe('#icon-123')
  })

  it('uses "Unknown" as folder name when name is missing', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <Placemark>
        <name>Orphan</name>
        <Point><coordinates>-3.0,56.0,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points[0].folder).toBe('Unknown')
  })

  it('handles fs errors gracefully', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: file not found')
    })

    const points = await parseEnviroworxKml('/fake/missing.kml')
    expect(points).toEqual([])
  })

  it('handles negative coordinates correctly', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Negative</name>
      <Placemark>
        <name>Southern Hemisphere</name>
        <Point><coordinates>151.2,-33.9,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

    vi.mocked(fs.readFileSync).mockReturnValue(kml)

    const points = await parseEnviroworxKml('/fake/path.kml')
    expect(points[0].latitude).toBe(-33.9)
    expect(points[0].longitude).toBe(151.2)
  })
})
