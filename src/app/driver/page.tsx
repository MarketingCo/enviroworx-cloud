'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getDriverJobs } from '@/lib/api'
import { completeJobAction, clockInOutAction } from '@/app/actions/operations'
import { abortJobWithNotification } from '@/app/actions/notifications'
import { DEFAULT_CONFIG } from '@/lib/config'
import toast, { Toaster } from 'react-hot-toast'

/**
 * DRIVER APP v2 — Mobile PWA for Enviroworx drivers
 * Improvements: voice notes, break timer, offline detection,
 * multi-map support (Waze/Google/Apple), improved photo flow.
 */

interface DriverState {
  driver: string | null
  lorry: string | null
  shiftId: string | null
  pin: string | null
  onBreak: boolean
  breakStart: number | null
}

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

function useBreakTimer(breakStart: number | null) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!breakStart) { setElapsed(0); return }
    const tick = () => setElapsed(Math.floor((Date.now() - breakStart) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [breakStart])
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const secs = (elapsed % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

export default function DriverApp() {
  const [state, setState] = useState<DriverState>({ driver: null, lorry: null, shiftId: null, pin: null, onBreak: false, breakStart: null })
  const [screen, setScreen] = useState<'login' | 'jobs'>('login')
  const [drivers, setDrivers] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loaderText, setLoaderText] = useState('Connecting...')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedLorry, setSelectedLorry] = useState('')
  const [pin, setPin] = useState('')
  const isOnline = useOnline()
  const breakTimer = useBreakTimer(state.breakStart)

  const isConfigMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  useEffect(() => {
    if (isConfigMissing) { setLoading(false); return }
    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadInitialData() {
    const [{ data: drvs }, { data: lors }] = await Promise.all([
      supabase.from('drivers_public' as 'drivers').select('id, name, status, phone').order('name'),
      supabase.from('lorries').select('*').order('registration'),
    ])
    setDrivers(drvs ?? [])
    setLorries(lors ?? [])
    const saved = localStorage.getItem('env_driver_shift')
    if (saved) {
      const s = JSON.parse(saved)
      setState(s)
      await loadJobs(s.driver)
    }
    setLoading(false)
  }

  async function loadJobs(driverName?: string) {
    const name = driverName || state.driver
    if (!name) return
    setLoaderText('Building Route...')
    setLoading(true)
    try {
      const result = await getDriverJobs(name)
      setJobs(result.jobs)
      setScreen('jobs')
    } catch (e: any) {
      toast.error('Error loading jobs: ' + e.message)
    }
    setLoading(false)
  }

  async function handleClockIn() {
    if (!selectedDriver || !selectedLorry || !pin) return toast.error('Select name, lorry, and enter PIN')
    setLoading(true)
    setLoaderText('Clocking In...')
    const authRes = await fetch('/api/auth/driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selectedDriver, pin }),
    })
    if (!authRes.ok) {
      toast.error('Invalid PIN')
      setLoading(false)
      return
    }
    const result = await clockInOutAction(selectedDriver, pin, 'IN', selectedLorry)
    if (result.success) {
      const newState: DriverState = { driver: selectedDriver, lorry: selectedLorry, shiftId: result.shiftId ?? null, pin, onBreak: false, breakStart: null }
      setState(newState)
      localStorage.setItem('env_driver_shift', JSON.stringify(newState))
      toast.success(result.message)
      await loadJobs(selectedDriver)
    } else {
      toast.error(result.message)
      setLoading(false)
    }
  }

  async function handleClockOut() {
    if (!confirm('Clock out and end your shift?')) return
    setLoading(true)
    setLoaderText('Clocking Out...')
    await clockInOutAction(state.driver!, state.pin!, 'OUT', state.lorry!)
    localStorage.removeItem('env_driver_shift')
    window.location.reload()
  }

  function toggleBreak() {
    const newState = state.onBreak
      ? { ...state, onBreak: false, breakStart: null }
      : { ...state, onBreak: true, breakStart: Date.now() }
    setState(newState)
    localStorage.setItem('env_driver_shift', JSON.stringify(newState))
    toast(newState.onBreak ? '☕ Break started' : '🚛 Back on the road!', { icon: newState.onBreak ? '☕' : '✅' })
  }

  async function handleComplete(job: any, skipId: string, photoUrl?: string) {
    if (!skipId.trim()) return toast.error('⚠️ Enter the Skip ID')
    setLoading(true)
    setLoaderText('Syncing...')
    try {
      const result = await completeJobAction({
        orderId: job.id,
        skipId,
        jobType: job.job_type,
        address: job.address,
        customerName: job.customer_name,
        lorryReg: state.lorry || '',
        photoUrl,
      })
      toast.success(result.message)
      setJobs(prev => prev.filter(j => j.id !== job.id))
    } catch (e: any) {
      toast.error(e.message)
    }
    setLoading(false)
  }

  async function handleAbort(jobId: string, reason: string) {
    if (!reason) return toast.error('Enter a reason')
    setLoading(true)
    setLoaderText('Aborting...')
    const result = await abortJobWithNotification(jobId, reason)
    if (result.success) {
      setJobs(prev => prev.filter(j => j.id !== jobId))
      toast.success('Job aborted & customer notified')
    } else {
      toast.error('Failed to abort: ' + result.error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-50">
        <div className="text-emerald-400 text-5xl mb-5 animate-pulse">📡</div>
        <h3 className="text-white text-lg font-bold">{loaderText}</h3>
      </div>
    )
  }

  if (isConfigMissing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-white">
        <span className="text-6xl mb-6">⚠️</span>
        <h2 className="text-2xl font-black mb-4 uppercase">System Offline</h2>
        <p className="text-slate-400 mb-8 max-w-sm">Supabase keys missing in <strong>.env.local</strong>.</p>
      </div>
    )
  }

  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-5">
        <Toaster position="top-center" />
        <h1 className="text-3xl font-black text-emerald-400 mb-2">🚛 ENVIROWORX</h1>
        <p className="text-slate-400 mb-10">Driver Portal</p>
        <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
          className="w-full max-w-sm p-4 rounded-xl bg-slate-800 border-2 border-slate-600 text-white text-lg font-semibold mb-5">
          <option value="">-- Select Your Name --</option>
          {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select value={selectedLorry} onChange={e => setSelectedLorry(e.target.value)}
          className="w-full max-w-sm p-4 rounded-xl bg-slate-800 border-2 border-slate-600 text-white text-lg font-semibold mb-5">
          <option value="">-- Select Lorry --</option>
          {lorries.map(l => <option key={l.id} value={l.registration}>{l.registration}</option>)}
        </select>
        <input type="number" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter 4-Digit PIN"
          className="w-full max-w-sm p-4 rounded-xl bg-slate-800 border-2 border-slate-600 text-white text-lg font-semibold mb-8"
          maxLength={4} inputMode="numeric" />
        <button onClick={handleClockIn}
          className="w-full max-w-sm bg-gradient-to-r from-emerald-500 to-emerald-700 p-5 rounded-xl text-white font-black text-lg shadow-lg">
          🕐 CLOCK IN & START
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-28">
      <Toaster position="top-center" />

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-600 text-white text-center py-2 text-sm font-bold tracking-wide animate-pulse">
          ⚠️ NO INTERNET — Changes will sync when back online
        </div>
      )}

      {/* Break Banner */}
      {state.onBreak && (
        <div className="bg-amber-500 text-black text-center py-3 text-sm font-black tracking-wide">
          ☕ ON BREAK — {breakTimer}
        </div>
      )}

      {/* App Bar */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-40 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
        <div className="font-bold text-base flex items-center gap-2">
          <span className="text-slate-400">👤</span>
          <span>{state.driver}</span>
          <span className="text-slate-600 text-sm">· {state.lorry}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleBreak}
            className={`px-3 py-1.5 rounded-full font-black text-xs transition ${state.onBreak ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
            {state.onBreak ? `☕ ${breakTimer}` : '☕ Break'}
          </button>
          <div onClick={() => loadJobs()} className="bg-emerald-500 text-black px-3 py-1.5 rounded-full font-extrabold text-xs cursor-pointer shadow">
            ↻ {jobs.length}
          </div>
          <button onClick={handleClockOut} className="text-red-400 text-xl px-1">🚪</button>
        </div>
      </div>

      {/* Job List */}
      <div className="p-4 space-y-5">
        {jobs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold">Route Complete</h3>
            <p className="text-slate-400">No active jobs. Clock out when ready.</p>
            <button onClick={handleClockOut} className="mt-8 bg-red-600 text-white px-8 py-4 rounded-xl font-black text-lg">
              🚪 CLOCK OUT
            </button>
          </div>
        ) : (
          jobs.map((job, i) => (
            <DriverJobCard
              key={job.id}
              job={job}
              index={i + 1}
              total={jobs.length}
              config={DEFAULT_CONFIG}
              onComplete={handleComplete}
              onAbort={handleAbort}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---- DRIVER JOB CARD v2 ----
function DriverJobCard({ job, index, total, config, onComplete, onAbort }: any) {
  const [skipId, setSkipId] = useState('')
  const [showAbort, setShowAbort] = useState(false)
  const [abortReason, setAbortReason] = useState('')
  const [photoTaken, setPhotoTaken] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | undefined>()
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showMapMenu, setShowMapMenu] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceUploaded, setVoiceUploaded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const encodedAddr = encodeURIComponent(job.address)
  const wazeUrl = `https://waze.com/ul?q=${encodedAddr}`
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddr}`
  const appleMapsUrl = `http://maps.apple.com/?daddr=${encodedAddr}`

  const borderColor = job.job_type === 'Delivery' ? 'border-t-emerald-500'
    : job.job_type === 'Collection' ? 'border-t-red-500'
    : 'border-t-amber-500'
  const typeColor = job.job_type === 'Delivery' ? 'text-emerald-400'
    : job.job_type === 'Collection' ? 'text-red-400'
    : 'text-amber-400'
  const typeBadge = job.job_type === 'Delivery' ? 'bg-emerald-500/20 text-emerald-400'
    : job.job_type === 'Collection' ? 'bg-red-500/20 text-red-400'
    : 'bg-amber-500/20 text-amber-400'

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    const path = `proofs/${job.id}-${Date.now()}.jpg`
    const { data, error } = await supabase.storage.from('job-photos').upload(path, file)
    if (error) { toast.error('Photo upload failed'); setPhotoUploading(false); return }
    const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(data.path)
    setPhotoUrl(urlData.publicUrl)
    setPhotoTaken(true)
    setPhotoUploading(false)
    toast.success('📸 Photo attached!')
  }

  async function startVoiceNote() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const path = `voice-notes/${job.id}-${Date.now()}.webm`
        const { error } = await supabase.storage.from('job-photos').upload(path, blob)
        if (error) { toast.error('Voice upload failed'); return }
        setVoiceUploaded(true)
        toast.success('🎙️ Voice note saved!')
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  function stopVoiceNote() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  async function handleComplete() {
    if (!skipId.trim()) { toast.error('⚠️ Enter the Skip ID'); return }
    if (!photoTaken) { toast.error('📸 Take a photo first'); return }
    setCompleting(true)
    await onComplete(job, skipId, photoUrl)
    setCompleting(false)
  }

  return (
    <div className={`bg-slate-800 rounded-2xl border-t-[6px] ${borderColor} shadow-xl overflow-hidden`}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex justify-between items-start">
        <div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black mb-2 ${typeBadge}`}>
            {job.job_type === 'Delivery' ? '📦' : job.job_type === 'Collection' ? '🔄' : '↔️'} {job.job_type}
            {job.skip_size && <span className="opacity-70">· {job.skip_size}yd</span>}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Stop {index} of {total}</div>
        </div>
        <button onClick={() => setShowAbort(!showAbort)}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${showAbort ? 'bg-red-600 text-white' : 'bg-slate-700 text-red-400'}`}>
          {showAbort ? '✕ Cancel' : '⛔ Abort'}
        </button>
      </div>

      {/* Address + Customer */}
      <div className="px-5 pb-4 space-y-2">
        <div className="text-white font-black text-lg leading-tight">📍 {job.address}</div>
        <div className="text-slate-400 text-sm">👤 {job.customer_name}</div>
        {job.delivery_comments && (
          <div className="bg-amber-500/10 border-l-4 border-amber-500 p-3 rounded-r-lg text-sm text-amber-200 mt-2">
            📝 {job.delivery_comments}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="px-5 pb-4">
        <div className="relative">
          <button
            onClick={() => setShowMapMenu(!showMapMenu)}
            className="w-full bg-blue-500/15 border border-blue-500/30 text-blue-400 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
            🗺️ Navigate — {job.address.split(',')[0]}
            <span className="text-blue-500/50 ml-1">▼</span>
          </button>
          {showMapMenu && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden border border-slate-600">
              <a href={wazeUrl} target="_blank" onClick={() => setShowMapMenu(false)}
                className="flex items-center gap-3 px-5 py-4 border-b border-slate-600 hover:bg-slate-600 active:bg-slate-500 font-bold text-sm">
                <span className="text-xl">🗺️</span> Waze
              </a>
              <a href={googleMapsUrl} target="_blank" onClick={() => setShowMapMenu(false)}
                className="flex items-center gap-3 px-5 py-4 border-b border-slate-600 hover:bg-slate-600 active:bg-slate-500 font-bold text-sm">
                <span className="text-xl">🌐</span> Google Maps
              </a>
              <a href={appleMapsUrl} target="_blank" onClick={() => setShowMapMenu(false)}
                className="flex items-center gap-3 px-5 py-4 hover:bg-slate-600 active:bg-slate-500 font-bold text-sm">
                <span className="text-xl">🍎</span> Apple Maps
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Call Buttons */}
      <div className="px-5 pb-4 flex gap-2">
        <a href={`tel:${config.officePhone}`}
          className="flex-1 bg-slate-700 px-3 py-2.5 rounded-xl text-center text-sm font-bold hover:bg-slate-600 active:bg-slate-500">
          🏢 Office
        </a>
        {job.phone && (
          <a href={`tel:${job.phone}`}
            className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-2.5 rounded-xl text-center text-sm font-bold hover:bg-emerald-500/20">
            📞 Customer
          </a>
        )}
      </div>

      {/* Abort Panel */}
      {showAbort && (
        <div className="mx-5 mb-4 bg-red-500/10 p-4 rounded-xl border border-red-500/30">
          <h4 className="text-red-400 font-black mb-3 text-sm uppercase tracking-wide">Failed Delivery / Abort</h4>
          <input type="text" value={abortReason} onChange={e => setAbortReason(e.target.value)}
            placeholder="Reason (e.g. Gate locked, No access)"
            className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 mb-3 text-sm" />
          <button onClick={() => onAbort(job.id, abortReason)}
            className="w-full bg-red-600 py-3 rounded-lg font-black text-sm">
            Confirm Abort
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-slate-700 mx-5" />

      {/* Complete Job Section */}
      <div className="p-5 space-y-3">
        {/* Photo */}
        <label className={`flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer font-bold text-sm transition border-2 ${
          photoTaken ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : photoUploading ? 'border-slate-600 bg-slate-700 text-slate-400 animate-pulse' : 'border-dashed border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700'
        }`}>
          {photoUploading ? '⏳ Uploading...' : photoTaken ? '✅ Photo Attached — Tap to replace' : '📸 Take Proof Photo (required)'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} disabled={photoUploading} />
        </label>

        {/* Voice Note */}
        <div className="flex gap-2">
          {!isRecording ? (
            <button onClick={startVoiceNote}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${voiceUploaded ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
              {voiceUploaded ? '🎙️ Voice Note Saved' : '🎙️ Record Voice Note'}
            </button>
          ) : (
            <button onClick={stopVoiceNote}
              className="flex-1 py-3 rounded-xl font-black text-sm bg-red-600 text-white animate-pulse">
              ⏹️ Stop Recording...
            </button>
          )}
        </div>

        {/* Skip ID */}
        <input
          type="text"
          value={skipId}
          onChange={e => setSkipId(e.target.value)}
          placeholder={job.hint ? `Skip ID (hint: ${job.hint})` : 'Enter Skip ID'}
          className="w-full p-4 rounded-xl bg-slate-900 border-2 border-slate-600 text-lg font-bold focus:border-emerald-500 focus:outline-none transition"
          autoCapitalize="characters"
        />

        {/* Complete Button */}
        <button
          onClick={handleComplete}
          disabled={!photoTaken || !skipId.trim() || completing}
          className={`w-full py-4 rounded-xl font-black text-lg transition shadow-lg ${
            photoTaken && skipId.trim() && !completing
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-700 text-white active:from-emerald-600'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}>
          {completing ? '⏳ Syncing...' : photoTaken && skipId.trim() ? '✅ COMPLETE JOB' : !photoTaken ? '🔒 Photo Required' : '🔒 Enter Skip ID'}
        </button>
      </div>
    </div>
  )
}
