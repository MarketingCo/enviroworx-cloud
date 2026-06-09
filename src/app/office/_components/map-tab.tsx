'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { SKIP_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import KmlSyncButton from '@/components/KmlSyncButton'
import { MapPin, X } from 'lucide-react'
import {
  placeSkipOnMapAction,
  moveSkipLocationAction,
  collectSkipFromMapAction,
} from '@/app/actions/operations'
import { getMapDataAction } from '@/app/actions/office-data'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const EDINBURGH = { lat: 55.9533, lng: -3.1883 }
const PIN = (c: string) => `https://maps.google.com/mapfiles/ms/icons/${c}-dot.png`

// Load the Google Maps JS API once for the whole app.
let gmapsPromise: Promise<void> | null = null
function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).google?.maps) return Promise.resolve()
  if (gmapsPromise) return gmapsPromise
  gmapsPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&loading=async`
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(s)
  })
  return gmapsPromise
}

type PlaceForm = {
  lat: number
  lng: number
  skipSize: string
  customerName: string
  customerPhone: string
  address: string
  comments: string
  saving: boolean
}

export function MapTab() {
  const [skips, setSkips] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [liveOrders, setLiveOrders] = useState<any[]>([])
  const [externalPoints, setExternalPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [placeForm, setPlaceForm] = useState<PlaceForm | null>(null)

  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    'Live Trucks': true,
    'Live Orders': true,
    'Active Skips': true,
  })

  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoRef = useRef<any>(null)
  const fitDoneRef = useRef(false)

  // ── Load data + Google Maps script, subscribe to realtime ──────────────
  useEffect(() => {
    loadMapData()
    if (MAPS_KEY) {
      loadGoogleMaps()
        .then(() => setReady(true))
        .catch(() => toast.error('Could not load Google Maps'))
    }

    const mapSync = supabase
      .channel('map-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadMapData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => loadMapData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => loadMapData())
      .subscribe()

    return () => {
      supabase.removeChannel(mapSync)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadMapData() {
    let data
    try {
      data = await getMapDataAction()
    } catch (e: any) {
      toast.error(e?.message || 'Could not load map data')
      setLoading(false)
      return
    }
    const points = data.externalPoints
    setSkips(data.skips)
    setVehicles(data.vehicles)
    setLiveOrders(data.liveOrders)
    setExternalPoints(points)

    const folders = [...new Set(points.map((p) => p.folder || 'Unknown'))]
    setVisibleLayers((prev) => {
      const next = { ...prev }
      folders.forEach((f) => {
        if (next[f] === undefined) next[f] = false
      })
      return next
    })

    setLoading(false)
  }

  function toggleLayer(name: string) {
    setVisibleLayers((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  // ── Create the map once ────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return
    const g = (window as any).google
    const el = document.getElementById('office-map-canvas')
    if (!g || !el || mapRef.current) return

    const map = new g.maps.Map(el, {
      center: EDINBURGH,
      zoom: 11,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      mapTypeId: 'roadmap',
    })
    infoRef.current = new g.maps.InfoWindow()
    mapRef.current = map

    // Click empty map → start placing a new skip at that point.
    map.addListener('click', (e: any) => {
      setPlaceForm({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        skipSize: '8',
        customerName: '',
        customerPhone: '',
        address: '',
        comments: '',
        saving: false,
      })
    })
  }, [ready])

  // ── (Re)draw markers when data or layers change ────────────────────────
  useEffect(() => {
    const g = (window as any).google
    const map = mapRef.current
    if (!g || !map) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    const bounds = new g.maps.LatLngBounds()
    let any = false

    const add = (marker: any, lat: number, lng: number) => {
      markersRef.current.push(marker)
      bounds.extend({ lat, lng })
      any = true
    }

    const openInfo = (marker: any, html: string, onReady?: () => void) => {
      marker.addListener('click', () => {
        infoRef.current.setContent(html)
        infoRef.current.open(map, marker)
        if (onReady) g.maps.event.addListenerOnce(infoRef.current, 'domready', onReady)
      })
    }

    // 1. Active skips — green, draggable, with contact + collect button
    if (visibleLayers['Active Skips']) {
      skips
        .filter((s) => s.latitude && s.longitude)
        .forEach((skip) => {
          const lat = Number(skip.latitude)
          const lng = Number(skip.longitude)
          const days = skip.delivery_date
            ? Math.floor((Date.now() - new Date(skip.delivery_date).getTime()) / 86400000)
            : 0
          const marker = new g.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
            icon: PIN('green'),
            title: `${skip.skip_size}yd — ${skip.customer_name || 'Skip'}`,
          })
          marker.addListener('dragend', async (e: any) => {
            try {
              await moveSkipLocationAction(skip.id, e.latLng.lat(), e.latLng.lng())
              toast.success('Skip moved')
            } catch {
              toast.error('Could not move skip')
              loadMapData()
            }
          })
          const phone = skip.customer_phone
            ? `<a href="tel:${skip.customer_phone}" style="color:#2563eb;">${skip.customer_phone}</a>`
            : '—'
          const html = `
            <div style="font-family:sans-serif;min-width:210px;color:#0f172a;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                <b style="color:#059669;text-transform:uppercase;font-size:11px;">${skip.skip_size}yd skip</b>
                <span style="font-size:10px;background:#ecfdf5;color:#047857;padding:2px 6px;border-radius:4px;font-weight:bold;">${days} days on hire</span>
              </div>
              <b style="font-size:14px;display:block;">${skip.customer_name || 'Unknown customer'}</b>
              <div style="font-size:12px;color:#475569;margin-top:2px;">📞 ${phone}</div>
              <div style="font-size:12px;color:#475569;margin-top:2px;">📍 ${skip.delivery_address || 'No address'}</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;">Skip ID: <b>${skip.skip_id}</b> · Dropped ${skip.delivery_date ? new Date(skip.delivery_date).toLocaleDateString() : '—'}</div>
              ${skip.comments ? `<div style="margin-top:6px;font-size:11px;background:#f1f5f9;padding:6px;border-radius:4px;">${skip.comments}</div>` : ''}
              <button id="collect-${skip.id}" style="margin-top:10px;width:100%;background:#f59e0b;color:#1e293b;border:none;padding:7px;border-radius:6px;font-weight:bold;font-size:11px;cursor:pointer;">Mark collected</button>
            </div>`
          openInfo(marker, html, () => {
            const btn = document.getElementById(`collect-${skip.id}`)
            if (btn)
              btn.onclick = async () => {
                try {
                  await collectSkipFromMapAction(skip.id)
                  infoRef.current.close()
                  toast.success('Skip collected')
                  loadMapData()
                } catch {
                  toast.error('Could not collect skip')
                }
              }
          })
          add(marker, lat, lng)
        })
    }

    // 2. Today's live orders — blue (delivery) / amber (collection)
    if (visibleLayers['Live Orders']) {
      liveOrders.forEach((o) => {
        const lat = Number(o.latitude)
        const lng = Number(o.longitude)
        const isCollection = o.job_type === 'Collection'
        const marker = new g.maps.Marker({
          position: { lat, lng },
          map,
          icon: PIN(isCollection ? 'yellow' : 'blue'),
          title: `${o.job_type} — ${o.customer_name}`,
        })
        openInfo(
          marker,
          `<div style="font-family:sans-serif;min-width:200px;color:#0f172a;">
             <b style="color:${isCollection ? '#d97706' : '#2563eb'};text-transform:uppercase;font-size:11px;">${o.job_type} today</b>
             <b style="font-size:14px;display:block;margin-top:4px;">${o.customer_name}</b>
             <div style="font-size:12px;color:#475569;">📍 ${o.address}</div>
             <div style="font-size:11px;color:#64748b;margin-top:4px;">Driver: <b>${o.driver_name || 'Unassigned'}</b> · ${o.skip_size}yd</div>
           </div>`
        )
        add(marker, lat, lng)
      })
    }

    // 3. Live trucks — red
    if (visibleLayers['Live Trucks']) {
      vehicles.forEach((v) => {
        const lat = Number(v.latitude)
        const lng = Number(v.longitude)
        const mins = v.last_updated
          ? Math.floor((Date.now() - new Date(v.last_updated).getTime()) / 60000)
          : 9999
        if (mins > 1440) return // offline > 24h
        const marker = new g.maps.Marker({
          position: { lat, lng },
          map,
          icon: PIN('red'),
          title: v.registration || v.reg || 'Truck',
        })
        openInfo(
          marker,
          `<div style="font-family:sans-serif;min-width:160px;color:#0f172a;">
             <b style="color:#2563eb;font-size:14px;">${v.registration || v.reg || 'Unknown'}</b>
             <div style="font-size:12px;color:#475569;margin-top:4px;">Speed: <b>${v.speed || 0} mph</b></div>
             <div style="font-size:12px;color:#475569;">Last seen: <b>${mins < 1 ? 'just now' : `${mins}m ago`}</b></div>
           </div>`
        )
        add(marker, lat, lng)
      })
    }

    // 4. Legacy KML folders — purple, toggled per folder
    externalPoints.forEach((p) => {
      if (!visibleLayers[p.folder || 'Unknown']) return
      const lat = Number(p.latitude)
      const lng = Number(p.longitude)
      const marker = new g.maps.Marker({
        position: { lat, lng },
        map,
        icon: PIN('purple'),
        title: p.name || p.folder,
      })
      openInfo(
        marker,
        `<div style="font-family:sans-serif;min-width:180px;color:#0f172a;">
           <div style="color:#64748b;font-size:9px;font-weight:bold;text-transform:uppercase;">Legacy: ${p.folder}</div>
           <b style="font-size:13px;display:block;margin-top:2px;">${p.name}</b>
           <p style="font-size:11px;color:#475569;margin:4px 0 0;">${p.description || ''}</p>
         </div>`
      )
      add(marker, lat, lng)
    })

    if (any && !fitDoneRef.current) {
      mapRef.current.fitBounds(bounds)
      fitDoneRef.current = true
    }
  }, [ready, skips, vehicles, liveOrders, externalPoints, visibleLayers])

  async function submitPlace() {
    if (!placeForm) return
    setPlaceForm({ ...placeForm, saving: true })
    try {
      const res = await placeSkipOnMapAction({
        skipSize: placeForm.skipSize,
        customerName: placeForm.customerName,
        customerPhone: placeForm.customerPhone,
        address: placeForm.address,
        latitude: placeForm.lat,
        longitude: placeForm.lng,
        comments: placeForm.comments,
      })
      toast.success((res as any)?.message || 'Skip placed')
      setPlaceForm(null)
      loadMapData()
    } catch (e: any) {
      toast.error(e?.message || 'Could not place skip')
      setPlaceForm((f) => (f ? { ...f, saving: false } : f))
    }
  }

  if (!MAPS_KEY) {
    return (
      <div className="p-10 text-center space-y-3">
        <MapPin className="mx-auto text-slate-600" size={40} />
        <h2 className="text-lg font-black text-white uppercase tracking-tighter">Map not configured</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Set <code className="text-primary">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> (a browser key with the
          Maps JavaScript API enabled, restricted to your domain) in Vercel, then redeploy.
        </p>
      </div>
    )
  }

  if (loading)
    return (
      <div className="p-10 text-center text-slate-500 font-black uppercase tracking-widest animate-pulse">
        Loading map…
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tighter italic">Skip Map</h2>
          <p className="text-xs text-slate-500">Click anywhere on the map to drop a skip · drag a pin to move it</p>
        </div>
        <div className="flex gap-2">
          <KmlSyncButton />
          <button
            onClick={loadMapData}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-xs font-black transition-all"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto no-scrollbar">
        {Object.entries(visibleLayers).map(([name, isVisible]) => (
          <button
            key={name}
            onClick={() => toggleLayer(name)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
              isVisible
                ? 'bg-primary border-primary text-slate-900 shadow-lg shadow-primary/20'
                : 'bg-slate-900 border-white/10 text-slate-500 hover:border-white/30'
            }`}
          >
            {isVisible ? '● ' : '○ '}
            {name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: '650px' }}>
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl overflow-hidden relative border border-white/5 shadow-2xl">
          <div id="office-map-canvas" className="w-full h-full" />

          {placeForm && (
            <div className="absolute top-4 right-4 z-10 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Place a skip</h3>
                <button onClick={() => setPlaceForm(null)} className="text-slate-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <select
                value={placeForm.skipSize}
                onChange={(e) => setPlaceForm({ ...placeForm, skipSize: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                {SKIP_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} yard
                  </option>
                ))}
              </select>
              <input
                value={placeForm.customerName}
                onChange={(e) => setPlaceForm({ ...placeForm, customerName: e.target.value })}
                placeholder="Customer name"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <input
                value={placeForm.customerPhone}
                onChange={(e) => setPlaceForm({ ...placeForm, customerPhone: e.target.value })}
                placeholder="Contact number"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <input
                value={placeForm.address}
                onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })}
                placeholder="Address / notes for location"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <p className="text-[10px] text-slate-500">
                📍 {placeForm.lat.toFixed(5)}, {placeForm.lng.toFixed(5)}
              </p>
              <button
                onClick={submitPlace}
                disabled={placeForm.saving}
                className="w-full bg-primary text-slate-900 font-black uppercase text-xs tracking-widest py-2.5 rounded-lg disabled:opacity-50"
              >
                {placeForm.saving ? 'Saving…' : 'Drop skip here'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            Skips on site ({skips.length})
          </h3>
          {skips.map((skip) => (
            <div key={skip.id} className="bg-slate-900 border border-white/5 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 uppercase px-1.5 py-0.5 rounded">
                  {skip.skip_size}yd
                </span>
                <span className="text-[8px] font-bold text-slate-600 italic">{skip.skip_id}</span>
              </div>
              <p className="font-bold text-white text-xs truncate">{skip.customer_name || 'Unknown'}</p>
              <p className="text-[9px] text-slate-500 truncate mt-0.5">🏗️ {skip.delivery_address || 'No address'}</p>
            </div>
          ))}
          {liveOrders.map((o) => (
            <div key={o.id} className="bg-slate-900 border border-white/5 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                    o.job_type === 'Collection' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  {o.job_type}
                </span>
                <span className="text-[8px] font-bold text-slate-600 italic">{o.status}</span>
              </div>
              <p className="font-bold text-white text-xs truncate">{o.customer_name}</p>
              <p className="text-[9px] text-slate-500 truncate mt-0.5">📍 {o.address}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ────────────────────────────────────────────────────────────
