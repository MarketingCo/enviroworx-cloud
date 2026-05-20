'use server'

import { requireOfficeSession } from '@/lib/session'

/** Scotland Central Belt — bias autocomplete to Edinburgh / Glasgow / Stirling corridor */
const SCOTLAND_CENTRAL_BIAS = '55.9,-3.5'
const SCOTLAND_RADIUS_M = 65000

export type AddressSuggestion = {
  description: string
  placeId: string
}

export async function searchAddressSuggestionsAction(input: string): Promise<AddressSuggestion[]> {
  await requireOfficeSession()

  const q = input.trim()
  if (q.length < 3) return []

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY missing — address autocomplete disabled')
    return []
  }

  const params = new URLSearchParams({
    input: q,
    key: apiKey,
    components: 'country:gb',
    location: SCOTLAND_CENTRAL_BIAS,
    radius: String(SCOTLAND_RADIUS_M),
    types: 'address',
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    { next: { revalidate: 0 } }
  )
  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('Places autocomplete:', data.status, data.error_message)
    return []
  }

  return (data.predictions ?? []).map((p: { description: string; place_id: string }) => ({
    description: p.description,
    placeId: p.place_id,
  }))
}

export async function resolvePlaceAddressAction(placeId: string) {
  await requireOfficeSession()

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey || !placeId) return null

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: 'formatted_address,geometry',
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
    { next: { revalidate: 0 } }
  )
  const data = await res.json()

  if (data.status !== 'OK' || !data.result) return null

  const loc = data.result.geometry?.location
  return {
    address: data.result.formatted_address as string,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
  }
}
