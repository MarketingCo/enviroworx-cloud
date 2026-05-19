'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import KmlSyncButton from '@/components/KmlSyncButton'
import { LayoutDashboard, Truck, Weight, CalendarPlus, Users, FileText, Wrench, RefreshCw, CheckCircle, Clock, AlertTriangle, Package, TrendingUp, ChevronRight, Zap, X, Search, DollarSign, Settings, Trash2 } from 'lucide-react'
import { getDashboardStats, getDispatchJobs, getStoredTare, searchCustomers, getCustomerTimeline, generateReport, getSkipUtilization, getLorries, getDriversList, getCustomPricingList } from '@/lib/api'
import { assignDriverToJobAction, autoAssignJobsAction, processBookingAction, logActiveTipperAction, processWeightLogAction, markJobPaidAction, cancelBookingAction, updateDriverPinAction, updateConfigAction, addCustomPriceAction, deleteCustomPriceAction } from '@/app/actions/operations'

import { fmt, today, tomorrow, KpiCard, SectionHeader, Badge, statusColor } from './shared'

export function MapTab() {
  const [skips, setSkips] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [liveOrders, setLiveOrders] = useState<any[]>([])
  const [externalPoints, setExternalPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  
  // Layer visibility state
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    'Live Trucks': true,
    'Live Orders': true,
    'Active Skips': true,
  })

  useEffect(() => {
    loadMapData()
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.async = true
      script.onload = () => setMapLoaded(true)
      document.head.appendChild(script)
    } else {
      setMapLoaded(true)
    }

    // Set up realtime sync for the map
    const mapSync = supabase.channel('map-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadMapData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => loadMapData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => loadMapData())
      .subscribe()

    return () => { supabase.removeChannel(mapSync) }
  }, [])

  useEffect(() => {
    if (mapLoaded && (!loading)) initMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, skips, vehicles, liveOrders, externalPoints, loading, visibleLayers])

  async function loadMapData() {
    const today = new Date().toISOString().split('T')[0]
    
    const [
      { data: sData },
      { data: vData },
      { data: oData },
      { data: eData }
    ] = await Promise.all([
      supabase.from('inventory').select('*').in('status', ['In Use', 'Delivered']),
      supabase.from('vehicles').select('*').not('latitude', 'is', null),
      supabase.from('orders').select('*').eq('date', today).not('latitude', 'is', null),
      supabase.from('external_map_points').select('*')
    ])

    const points = eData ?? []
    setSkips(sData ?? [])
    setVehicles(vData ?? [])
    setLiveOrders(oData ?? [])
    setExternalPoints(points)

    // Automatically add found KML folders to layer controls (default to false for cleanliness)
    const folders = [...new Set(points.map(p => p.folder || 'Unknown'))]
    setVisibleLayers(prev => {
      const next = { ...prev }
      folders.forEach(f => { if (next[f] === undefined) next[f] = false })
      return next
    })

    setLoading(false)
  }

  function toggleLayer(name: string) {
    setVisibleLayers(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function initMap() {
    const L = (window as any).L
    if (!L) return
    const container = L.DomUtil.get('office-map-canvas')
    if (container) (container as any)._leaflet_id = null
    const map = L.map('office-map-canvas').setView([55.9533, -3.1883], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    
    const allMarkers: any[] = []

    // 1. Live Orders
    if (visibleLayers['Live Orders']) {
      liveOrders.forEach(o => {
        const isCollection = o.job_type === 'Collection'
        const icon = L.divIcon({
          className: 'bg-transparent',
          html: `<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${isCollection ? '📥' : '📦'}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
        const marker = L.marker([o.latitude, o.longitude], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:sans-serif; min-width:200px; color:#f8fafc;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:8px;">
              <b style="color:${isCollection ? '#f59e0b' : '#3b82f6'}; text-transform:uppercase; font-size:10px;">${o.job_type} TODAY</b>
              <span style="font-size:9px; background:#1e293b; padding:2px 6px; border-radius:4px; font-weight:bold;">${o.status}</span>
            </div>
            <b style="font-size:14px; display:block; margin-bottom:4px;">${o.customer_name}</b>
            <small style="color:#94a3b8; display:block; line-height:1.4;">📍 ${o.address}</small>
            <div style="margin-top:10px; font-size:11px; display:grid; grid-template-cols: 1fr 1fr; gap:8px; border-top:1px solid #334155; pt:8px;">
              <div><span style="color:#64748b;">Driver:</span><br/><b>${o.driver_name || 'Unassigned'}</b></div>
              <div><span style="color:#64748b;">Skip:</span><br/><b>${o.skip_size}yd</b></div>
            </div>
            ${o.comments ? `<div style="margin-top:8px; font-size:10px; background:#0f172a; padding:6px; border-radius:4px; color:#cbd5e1;">"${o.comments}"</div>` : ''}
            <a href="/office?tab=dispatch" style="display:block; text-align:center; background:#3b82f6; color:white; text-decoration:none; padding:6px; border-radius:4px; margin-top:10px; font-size:10px; font-weight:bold;">VIEW IN DISPATCH</a>
          </div>
        `, { backgroundColor: '#0f172a', borderColor: '#1e293b' })
        allMarkers.push(marker)
      })
    }

    // 2. Active Skips
    if (visibleLayers['Active Skips']) {
      skips.filter(s => s.latitude && s.longitude).forEach(skip => {
        const daysOnHire = skip.delivery_date ? Math.floor((Date.now() - new Date(skip.delivery_date).getTime()) / 86400000) : 0
        const icon = L.divIcon({
          className: 'bg-transparent',
          html: '<div style="font-size:20px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏗️</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
        const marker = L.marker([skip.latitude, skip.longitude], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:sans-serif; min-width:200px; color:#f8fafc;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:8px;">
              <b style="color:#10b981; text-transform:uppercase; font-size:10px;">${skip.skip_size}yd Skip (LIVE)</b>
              <span style="font-size:9px; background:#064e3b; color:#34d399; padding:2px 6px; border-radius:4px; font-weight:bold;">${daysOnHire} DAYS ON HIRE</span>
            </div>
            <b style="font-size:14px; display:block; margin-bottom:4px;">${skip.customer_name}</b>
            <small style="color:#94a3b8; display:block; line-height:1.4;">📍 ${skip.delivery_address}</small>
            <div style="margin-top:10px; font-size:11px; display:grid; grid-template-cols: 1fr 1fr; gap:8px; border-top:1px solid #334155; pt:8px;">
              <div><span style="color:#64748b;">Skip ID:</span><br/><b>${skip.skip_id}</b></div>
              <div><span style="color:#64748b;">Delivered:</span><br/><b>${skip.delivery_date ? new Date(skip.delivery_date).toLocaleDateString() : 'N/A'}</b></div>
            </div>
            ${skip.comments ? `<div style="margin-top:8px; font-size:10px; background:#0f172a; padding:6px; border-radius:4px; color:#cbd5e1;">Note: ${skip.comments}</div>` : ''}
          </div>
        `)
        allMarkers.push(marker)
      })
    }

    // 3. Trucks
    if (visibleLayers['Live Trucks']) {
      vehicles.forEach(v => {
        const lastSeen = v.last_updated ? new Date(v.last_updated) : null
        const diffMinutes = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 60000) : 9999
        const isStationary = (v.speed || 0) === 0
        const isIdle = isStationary && diffMinutes > 20 && diffMinutes < 180 // Idle between 20m and 3h
        const isStale = diffMinutes > 30
        const isOffline = diffMinutes > 1440 // 24 hours

        if (isOffline) return 

        const truckIcon = L.divIcon({
          className: 'bg-transparent',
          html: `
            <div class="relative">
              ${isIdle ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>' : ''}
              ${isIdle ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-sm"></div>' : ''}
              <div style="font-size:24px; text-shadow:0 2px 4px rgba(0,0,0,0.5); opacity:${isStale ? '0.4' : '1'}; filter:${isStale ? 'grayscale(1)' : 'none'};">🚛</div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })

        const marker = L.marker([v.latitude, v.longitude], { icon: truckIcon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:sans-serif; color:#f8fafc; min-width:160px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:6px; margin-bottom:6px;">
              <b style="color:#3b82f6; font-size:14px;">${v.registration || v.reg || 'Unknown'}</b>
              <span style="font-size:8px; font-weight:black; padding:2px 4px; border-radius:3px; background:${isIdle ? '#7f1d1d' : (isStale ? '#334155' : '#064e3b')}; color:${isIdle ? '#fecaca' : (isStale ? '#94a3b8' : '#34d399')};">
                ${isIdle ? 'IDLE ALERT' : (isStale ? 'STALE' : 'LIVE')}
              </span>
            </div>
            <div style="font-size:12px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:#64748b;">Speed:</span>
                <b style="${(v.speed || 0) > 0 ? 'color:#10b981;' : ''}">${v.speed || 0} mph</b>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:#64748b;">Last Seen:</span>
                <b>${diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`}</b>
              </div>
              ${isIdle ? `<p style="margin-top:8px; color:#f87171; font-weight:bold; font-size:10px; text-align:center; background:#450a0a; padding:4px; border-radius:4px;">⚠️ Stationary for ${diffMinutes}m</p>` : ''}
            </div>
          </div>
        `)
        allMarkers.push(marker)
      })
    }

    // 4. KML Folders (Independent Layers)
    externalPoints.forEach(p => {
      if (!visibleLayers[p.folder || 'Unknown']) return

      const getIconHtml = (folder: string) => {
        let emoji = '📍'
        if (folder.includes('Collections')) emoji = '📤'
        if (folder.includes('Delivered')) emoji = '✅'
        if (folder.includes('OUT FOR DELIVERY')) emoji = '🚚'
        if (folder.match(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/i)) emoji = '📅'
        return `<div style="font-size:20px;opacity:0.8;">${emoji}</div>`
      }

      const icon = L.divIcon({
        className: 'bg-transparent',
        html: getIconHtml(p.folder || ''),
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
      const marker = L.marker([p.latitude, p.longitude], { icon }).addTo(map)
      marker.bindPopup(`
        <div style="font-family:sans-serif; min-width:180px;">
          <div style="color:#64748b; font-size:9px; font-weight:black; text-transform:uppercase; margin-bottom:4px;">Legacy: ${p.folder}</div>
          <b style="font-size:13px; display:block; margin-bottom:4px;">${p.name}</b>
          <p style="font-size:11px; color:#475569; line-height:1.4; margin:0;">${p.description || 'No legacy description'}</p>
        </div>
      `)
      allMarkers.push(marker)
    })

    if (allMarkers.length > 0) {
      const group = new L.featureGroup(allMarkers)
      map.fitBounds(group.getBounds().pad(0.1))
    }
  }

  if (loading) return <div className="p-10 text-center text-slate-500 font-black uppercase tracking-widest animate-pulse">Loading map architecture...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tighter italic">Multi-Layer Map Engine</h2>
          <p className="text-xs text-slate-500">Select layers below to toggle visibility</p>
        </div>
        <div className="flex gap-2">
          <KmlSyncButton />
          <button onClick={loadMapData} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-xs font-black transition-all">↻ Refresh All</button>
        </div>
      </div>

      {/* Layer Controls */}
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
            {isVisible ? '● ' : '○ '}{name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: '650px' }}>
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl overflow-hidden relative border border-white/5 shadow-2xl">
          <div id="office-map-canvas" className="w-full h-full" />
        </div>
        <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Live Telemetry</h3>
          {liveOrders.map(o => (
            <div key={o.id} className="bg-slate-900 border border-white/5 rounded-xl p-3 hover:bg-slate-800/50 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${o.job_type === 'Collection' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>{o.job_type}</span>
                <span className="text-[8px] font-bold text-slate-600 tracking-tighter italic">{o.status}</span>
              </div>
              <p className="font-bold text-white text-xs truncate">{o.customer_name}</p>
              <p className="text-[9px] text-slate-500 truncate mt-0.5">📍 {o.address}</p>
            </div>
          ))}
          {skips.map(skip => (
            <div key={skip.id} className="bg-slate-900 border border-white/5 rounded-xl p-3 hover:bg-slate-800/50 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 uppercase px-1.5 py-0.5 rounded">{skip.skip_size}yd Skip</span>
                <span className="text-[8px] font-bold text-slate-600 italic">Delivered</span>
              </div>
              <p className="font-bold text-white text-xs truncate">{skip.customer_name}</p>
              <p className="text-[9px] text-slate-500 truncate mt-0.5">🏗️ {skip.delivery_address || 'Unknown'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ────────────────────────────────────────────────────────────
