'use server'

import { requireOfficeSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'
import { geocodeAddress } from './geo'

export type OptimisedStop = {
  orderId: string
  customerName: string
  address: string
  jobType: string
  skipSize: string
  legDistanceKm: number
  legDurationMin: number
}

export type OptimisedRoute = {
  driverName: string
  date: string
  yard: string
  stops: OptimisedStop[]
  totalDistanceKm: number
  totalDurationMin: number
}

async function getYardAddress(tenantId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', 'yard_address')
    .maybeSingle()
  return (data?.value as string) || DEFAULT_CONFIG.officeAddress
}

/** Order a driver's day with the Google Directions API (round trip from
 *  the yard, optimize:true). Returns the suggested sequence — nothing is
 *  saved until saveRouteOrderAction. */
export async function optimiseDriverRouteAction(driverName: string, date: string): Promise<OptimisedRoute> {
  const session = await requireOfficeSession()
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not configured')

  const { data: jobs, error } = await supabaseAdmin
    .from('orders')
    .select('id, customer_name, address, job_type, skip_size, latitude, longitude')
    .eq('tenant_id', session.tenantId)
    .eq('driver_name', driverName)
    .eq('date', date)
    .not('status', 'in', '("Completed","Cancelled","Aborted")')
  if (error) throw new Error(error.message)
  if (!jobs || jobs.length < 2) throw new Error('Need at least 2 open jobs to optimise')
  if (jobs.length > 23) throw new Error('Too many stops for one optimisation (max 23)')

  // Geocode any job without coordinates and persist for next time.
  for (const job of jobs) {
    if (job.latitude == null || job.longitude == null) {
      const geo = job.address ? await geocodeAddress(job.address) : null
      if (!geo) throw new Error(`Could not geocode "${job.address}" — fix the address first`)
      job.latitude = geo.lat
      job.longitude = geo.lng
      await supabaseAdmin
        .from('orders')
        .update({ latitude: geo.lat, longitude: geo.lng })
        .eq('tenant_id', session.tenantId)
        .eq('id', job.id)
    }
  }

  const yard = await getYardAddress(session.tenantId)
  const params = new URLSearchParams({
    origin: yard,
    destination: yard,
    waypoints: 'optimize:true|' + jobs.map((j) => `${j.latitude},${j.longitude}`).join('|'),
    mode: 'driving',
    key: apiKey,
  })
  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`, {
    next: { revalidate: 0 },
  })
  const data = await res.json()
  if (data.status !== 'OK' || !data.routes?.[0]) {
    throw new Error(`Directions API: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`)
  }

  const route = data.routes[0]
  const order: number[] = route.waypoint_order
  // legs[i] = drive to the i-th stop in the optimised order; the last leg
  // is the run back to the yard.
  const stops: OptimisedStop[] = order.map((jobIdx: number, seq: number) => {
    const job = jobs[jobIdx]
    const leg = route.legs[seq]
    return {
      orderId: job.id,
      customerName: job.customer_name ?? '',
      address: job.address ?? '',
      jobType: job.job_type ?? '',
      skipSize: job.skip_size ?? '',
      legDistanceKm: Math.round(((leg?.distance?.value ?? 0) / 1000) * 10) / 10,
      legDurationMin: Math.round((leg?.duration?.value ?? 0) / 60),
    }
  })

  const totalMeters = route.legs.reduce((s: number, l: any) => s + (l.distance?.value ?? 0), 0)
  const totalSeconds = route.legs.reduce((s: number, l: any) => s + (l.duration?.value ?? 0), 0)

  return {
    driverName,
    date,
    yard,
    stops,
    totalDistanceKm: Math.round((totalMeters / 1000) * 10) / 10,
    totalDurationMin: Math.round(totalSeconds / 60),
  }
}

/** Persist an optimised sequence: route_order = position in the run. */
export async function saveRouteOrderAction(orderedIds: string[]) {
  const session = await requireOfficeSession()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabaseAdmin
      .from('orders')
      .update({ route_order: i + 1 })
      .eq('tenant_id', session.tenantId)
      .eq('id', orderedIds[i])
    if (error) throw new Error(error.message)
  }
  const { safeActivityLog } = await import('@/lib/supabase')
  await safeActivityLog({
    type: 'route.optimised',
    message: `Saved optimised route (${orderedIds.length} stops)`,
    status: 'Completed',
    actorName: session.name,
  })
  return { success: true }
}
