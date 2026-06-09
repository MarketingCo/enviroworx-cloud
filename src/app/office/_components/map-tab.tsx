'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { SKIP_SIZES, DEFAULT_CONFIG } from '@/lib/config'
import toast from 'react-hot-toast'
import KmlSyncButton from '@/components/KmlSyncButton'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { MapPin, X } from 'lucide-react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import {
  placeSkipOnMapAction,
  moveSkipLocationAction,
  collectSkipFromMapAction,
} from '@/app/actions/operations'
import { getMapDataAction, searchCustomersAction } from '@/app/actions/office-data'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const EDINBURGH = { lat: 55.9533, lng: -3.1883 }
// Advanced markers need a vector map, which needs a map id.
const MAP_ID = 'ENVIROWORX_OFFICE_MAP'

function makePin(opts: { background: string; glyphText?: string; scale?: number; borderColor?: string }) {
  const g = (window as any).google
  return new g.maps.marker.PinElement({
    background: opts.background,
    borderColor: opts.borderColor || 'rgba(0,0,0,0.25)',
    glyphColor: '#ffffff',
    glyph: opts.glyphText ?? '',
    scale: opts.scale ?? 1,
  }).element
}

// Load the Google Maps JS API once for the whole app.
let gmapsPromise: Promise<void> | null = null
function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).google?.maps) return Promise.resolve()
  if (gmapsPromise) return gmapsPromise
  gmapsPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=marker,places&loading=async`
    s.async = true
    s.defer = true
    s.onload = () => {
      // Make sure the marker library is initialised before anything builds pins.
      ;(window as any).google.maps
        .importLibrary('marker')
        .then(() => resolve())
        .catch(() => reject(new Error('Failed to load Google Maps marker library')))
    }
    s.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(s)
  })
  return gmapsPromise
}

type PlaceForm = {
  lat: number
  lng: number
  skipSize: string
  skipId: string
  customerName: string
  customerPhone: string
  address: string
  comments: string
  saving: boolean
}

/** Debounced existing-customer picker; free text stays valid for one-offs. */
function CustomerPicker({
  value,
  onChange,
  onPick,
}: {
  value: string
  onChange: (name: string) => void
  onPick: (c: { name: string; phone: string | null }) => void
}) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function handleInput(v: string) {
    onChange(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (v.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      try {
        const results = await searchCustomersAction(v)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch {
        setSuggestions([])
        setOpen(false)
      }
    }, 280)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Customer name"
        autoComplete="off"
        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false)
                  setSuggestions([])
                  onPick({ name: c.name, phone: c.phone })
                }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-primary hover:text-slate-900 border-b border-white/5 last:border-0"
              >
                {c.name}
                {c.phone && <span className="text-xs text-slate-400 ml-2">{c.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MapTab() {
  const [skips, setSkips] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [liveOrders, setLiveOrders] = useState<any[]>([])
  const [externalPoints, setExternalPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [placeForm, setPlaceForm] = useState<PlaceForm | null>(null)
  const [mapSearch, setMapSearch] = useState('')

  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    'Live Trucks': true,
    'Live Orders': true,
    'Active Skips': true,
  })

  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const markerByIdRef = useRef<Record<string, { marker: any; open: () => void }>>({})
  const skipClusterRef = useRef<MarkerClusterer | null>(null)
  const legacyClusterRef = useRef<MarkerClusterer | null>(null)
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

  function layerCount(name: string) {
    if (name === 'Active Skips') return skips.length
    if (name === 'Live Orders') return liveOrders.length
    if (name === 'Live Trucks') return vehicles.length
    return externalPoints.filter((p) => (p.folder || 'Unknown') === name).length
  }

  /** Pan to a pin from its side-panel card and open its info window. */
  function focusPin(id: string) {
    const entry = markerByIdRef.current[id]
    const map = mapRef.current
    if (!entry || !map) return
    const pos = entry.marker.position
    const lat = typeof pos?.lat === 'function' ? pos.lat() : pos?.lat
    const lng = typeof pos?.lng === 'function' ? pos.lng() : pos?.lng
    if (lat == null || lng == null) return
    map.panTo({ lat, lng })
    if ((map.getZoom() ?? 0) < 15) map.setZoom(15)
    entry.open()
  }

  // ── Create the map once ────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return
    const g = (window as any).google
    const el = document.getElementById('office-map-canvas')
    if (!g || !el || mapRef.current) return

    let savedType: string | null = null
    try {
      savedType = localStorage.getItem('ewx-map-type')
    } catch {}
    const map = new g.maps.Map(el, {
      center: EDINBURGH,
      zoom: 11,
      mapId: MAP_ID,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      mapTypeId: savedType || 'roadmap',
    })
    map.addListener('maptypeid_changed', () => {
      try {
        localStorage.setItem('ewx-map-type', map.getMapTypeId())
      } catch {}
    })
    infoRef.current = new g.maps.InfoWindow()
    mapRef.current = map

    // Click empty map → start placing a new skip at that point.
    map.addListener('click', (e: any) => {
      setPlaceForm({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        skipSize: '8',
        skipId: '',
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

    markersRef.current.forEach((m) => {
      m.map = null
    })
    markersRef.current = []
    markerByIdRef.current = {}
    skipClusterRef.current?.clearMarkers()
    legacyClusterRef.current?.clearMarkers()
    const bounds = new g.maps.LatLngBounds()
    let any = false

    const add = (marker: any, lat: number, lng: number) => {
      markersRef.current.push(marker)
      bounds.extend({ lat, lng })
      any = true
    }

    // Skips + legacy points cluster; orders/trucks stay individual pins.
    const skipMarkers: any[] = []
    const legacyMarkers: any[] = []
    const addClustered = (collection: any[], marker: any, lat: number, lng: number) => {
      collection.push(marker)
      bounds.extend({ lat, lng })
      any = true
    }

    const openInfo = (marker: any, html: string, onReady?: () => void) => {
      const open = () => {
        infoRef.current.setContent(html)
        infoRef.current.open({ map, anchor: marker })
        if (onReady) g.maps.event.addListenerOnce(infoRef.current, 'domready', onReady)
      }
      marker.addListener('click', open)
      return open
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
          const overstay = days > (DEFAULT_CONFIG.demurrageDays || 28)
          const size = String(skip.skip_size ?? '').replace(/yd$/i, '')
          const marker = new g.maps.marker.AdvancedMarkerElement({
            position: { lat, lng },
            gmpDraggable: true,
            content: makePin({
              background: overstay ? '#f59e0b' : '#10b981',
              glyphText: overstay ? `${size}!` : size,
            }),
            title: `${skip.skip_size}yd — ${skip.customer_name || 'Skip'}`,
          })
          marker.addListener('dragend', async (e: any) => {
            const pos = e?.latLng ?? marker.position
            const newLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
            const newLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
            try {
              await moveSkipLocationAction(skip.id, newLat, newLng)
              toast.success('Skip moved')
            } catch {
              toast.error('Could not move skip')
              loadMapData()
            }
          })
          const phone = skip.customer_phone
            ? `<a href="tel:${skip.customer_phone}" style="color:#2563eb;">${skip.customer_phone}</a>`
            : '—'
          const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
          const html = `
            <div style="font-family:system-ui,sans-serif;min-width:230px;color:#0f172a;font-size:13px;background:#fff;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                <b style="color:#059669;text-transform:uppercase;font-size:12px;">${skip.skip_size}yd skip</b>
                <span style="font-size:11px;background:${days > (DEFAULT_CONFIG.demurrageDays || 28) ? '#fffbeb;color:#b45309' : '#ecfdf5;color:#047857'};padding:2px 6px;border-radius:4px;font-weight:bold;">${days} days on hire</span>
              </div>
              <b style="font-size:14px;display:block;">${skip.customer_name || 'Unknown customer'}</b>
              <div style="color:#475569;margin-top:2px;">📞 ${phone}</div>
              <div style="color:#475569;margin-top:2px;">📍 ${skip.delivery_address || 'No address'}</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">Skip ID: <b>${skip.skip_id}</b> · Dropped ${skip.delivery_date ? new Date(skip.delivery_date).toLocaleDateString() : '—'}</div>
              ${skip.comments ? `<div style="margin-top:6px;font-size:12px;background:#f1f5f9;padding:6px;border-radius:4px;">${skip.comments}</div>` : ''}
              <div style="display:flex;gap:6px;margin-top:10px;">
                <button id="collect-${skip.id}" style="flex:1;background:#f59e0b;color:#1e293b;border:none;padding:8px 6px;border-radius:6px;font-weight:bold;font-size:12px;cursor:pointer;">Mark collected</button>
                <a href="${dirHref}" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;background:#2563eb;color:#fff;padding:8px 6px;border-radius:6px;font-weight:bold;font-size:12px;text-decoration:none;">Directions</a>
                ${skip.customer_phone ? `<a href="tel:${skip.customer_phone}" style="display:flex;align-items:center;justify-content:center;background:#059669;color:#fff;padding:8px 10px;border-radius:6px;font-weight:bold;font-size:12px;text-decoration:none;">Call</a>` : ''}
              </div>
            </div>`
          const open = openInfo(marker, html, () => {
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
          markerByIdRef.current[skip.id] = { marker, open }
          addClustered(skipMarkers, marker, lat, lng)
        })
    }

    // 2. Today's live orders — blue (delivery) / amber (collection)
    if (visibleLayers['Live Orders']) {
      liveOrders.forEach((o) => {
        const lat = Number(o.latitude)
        const lng = Number(o.longitude)
        const isCollection = o.job_type === 'Collection'
        const marker = new g.maps.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map,
          content: makePin({
            background: isCollection ? '#f59e0b' : '#3b82f6',
            glyphText: isCollection ? 'C' : 'D',
          }),
          title: `${o.job_type} — ${o.customer_name}`,
        })
        const orderOpen = openInfo(
          marker,
          `<div style="font-family:system-ui,sans-serif;min-width:210px;color:#0f172a;font-size:13px;background:#fff;">
             <b style="color:${isCollection ? '#d97706' : '#2563eb'};text-transform:uppercase;font-size:12px;">${o.job_type} today</b>
             <b style="font-size:14px;display:block;margin-top:4px;">${o.customer_name}</b>
             <div style="color:#475569;">📍 ${o.address}</div>
             <div style="font-size:12px;color:#64748b;margin-top:4px;">Driver: <b>${o.driver_name || 'Unassigned'}</b> · ${o.skip_size}yd</div>
             <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;margin-top:10px;background:#2563eb;color:#fff;padding:8px 6px;border-radius:6px;font-weight:bold;font-size:12px;text-decoration:none;">Get directions</a>
           </div>`
        )
        markerByIdRef.current[o.id] = { marker, open: orderOpen }
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
        const reg = v.registration || v.reg || ''
        const marker = new g.maps.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map,
          content: makePin({
            background: '#ef4444',
            glyphText: reg ? reg.replace(/\s/g, '').slice(-3) : '🚛',
          }),
          title: reg || 'Truck',
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
      const marker = new g.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        content: makePin({ background: '#8b5cf6', scale: 0.8 }),
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
      addClustered(legacyMarkers, marker, lat, lng)
    })

    if (!skipClusterRef.current) skipClusterRef.current = new MarkerClusterer({ map })
    if (!legacyClusterRef.current) legacyClusterRef.current = new MarkerClusterer({ map })
    skipClusterRef.current.addMarkers(skipMarkers)
    legacyClusterRef.current.addMarkers(legacyMarkers)

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
        skipId: placeForm.skipId.trim() || undefined,
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
            {name} · {layerCount(name)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: '650px' }}>
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl overflow-hidden relative border border-white/5 shadow-2xl">
          <div id="office-map-canvas" className="w-full h-full" />

          <div className="absolute top-4 left-4 z-10 w-72">
            <AddressAutocomplete
              value={mapSearch}
              onChange={setMapSearch}
              onResolved={({ address, lat, lng }) => {
                if (lat == null || lng == null) return
                mapRef.current?.panTo({ lat, lng })
                mapRef.current?.setZoom(17)
                setMapSearch('')
                setPlaceForm({
                  lat,
                  lng,
                  skipSize: '8',
                  skipId: '',
                  customerName: '',
                  customerPhone: '',
                  address,
                  comments: '',
                  saving: false,
                })
              }}
              placeholder="Search an address…"
              className="w-full bg-slate-900/95 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-2xl"
            />
          </div>

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
              <CustomerPicker
                value={placeForm.customerName}
                onChange={(name) => setPlaceForm((f) => (f ? { ...f, customerName: name } : f))}
                onPick={({ name, phone }) =>
                  setPlaceForm((f) =>
                    f ? { ...f, customerName: name, customerPhone: f.customerPhone || phone || '' } : f
                  )
                }
              />
              <input
                value={placeForm.customerPhone}
                onChange={(e) => setPlaceForm({ ...placeForm, customerPhone: e.target.value })}
                placeholder="Contact number"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <AddressAutocomplete
                value={placeForm.address}
                onChange={(address) => setPlaceForm((f) => (f ? { ...f, address } : f))}
                onResolved={({ address }) =>
                  // Keep the clicked lat/lng — only adopt the formatted address.
                  setPlaceForm((f) => (f ? { ...f, address } : f))
                }
                placeholder="Address / notes for location"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <input
                value={placeForm.skipId}
                onChange={(e) => setPlaceForm({ ...placeForm, skipId: e.target.value })}
                placeholder="Skip ID (optional — reuse existing)"
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
            <button
              key={skip.id}
              onClick={() => focusPin(skip.id)}
              className="w-full text-left bg-slate-900 border border-white/5 hover:border-primary/40 rounded-xl p-3 transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-black bg-emerald-500/10 text-emerald-500 uppercase px-1.5 py-0.5 rounded">
                  {skip.skip_size}yd
                </span>
                <span className="text-[11px] font-bold text-slate-500">{skip.skip_id}</span>
              </div>
              <p className="font-bold text-white text-xs truncate">{skip.customer_name || 'Unknown'}</p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">🏗️ {skip.delivery_address || 'No address'}</p>
            </button>
          ))}
          {liveOrders.map((o) => (
            <button
              key={o.id}
              onClick={() => focusPin(o.id)}
              className="w-full text-left bg-slate-900 border border-white/5 hover:border-primary/40 rounded-xl p-3 transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-[11px] font-black uppercase px-1.5 py-0.5 rounded ${
                    o.job_type === 'Collection' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  {o.job_type}
                </span>
                <span className="text-[11px] font-bold text-slate-500">{o.status}</span>
              </div>
              <p className="font-bold text-white text-xs truncate">{o.customer_name}</p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">📍 {o.address}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ────────────────────────────────────────────────────────────
