'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDriverJobs, completeJob, driverAbortJob, clockInOut } from '@/lib/api'
import { DEFAULT_CONFIG } from '@/lib/config'
import toast, { Toaster } from 'react-hot-toast'

/**
 * DRIVER APP (replaces DriverApp.html)
 * Mobile-first PWA for drivers in the field.
 * Accessed at /driver on mobile phones.
 */

interface DriverState {
  driver: string | null
  lorry: string | null
  shiftId: string | null
  pin: string | null
  onBreak: boolean
}

export default function DriverApp() {
  const [state, setState] = useState<DriverState>({ driver: null, lorry: null, shiftId: null, pin: null, onBreak: false })
  const [screen, setScreen] = useState<'login' | 'jobs'>('login')
  const [drivers, setDrivers] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [fuelCards, setFuelCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loaderText, setLoaderText] = useState('Connecting...')

  // Form state for login
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedLorry, setSelectedLorry] = useState('')
  const [pin, setPin] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    const [{ data: drvs }, { data: lors }] = await Promise.all([
      supabase.from('drivers').select('*').order('name'),
      supabase.from('lorries').select('*').order('registration'),
    ])
    setDrivers(drvs ?? [])
    setLorries(lors ?? [])

    // Check saved session
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
      setFuelCards(result.fuelCards)
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
    const result = await clockInOut(selectedDriver, pin, 'IN', selectedLorry)
    if (result.success) {
      const newState = { driver: selectedDriver, lorry: selectedLorry, shiftId: result.shiftId ?? null, pin, onBreak: false }
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
    await clockInOut(state.driver!, state.pin!, 'OUT', state.lorry!)
    localStorage.removeItem('env_driver_shift')
    window.location.reload()
  }

  async function handleComplete(job: any, skipId: string, photoUrl?: string) {
    if (!skipId.trim()) return toast.error('⚠️ Enter the Skip ID')
    setLoading(true)
    setLoaderText('Syncing...')
    try {
      const result = await completeJob({
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
    await driverAbortJob(jobId, reason)
    setJobs(prev => prev.filter(j => j.id !== jobId))
    toast.success('Job aborted')
    setLoading(false)
  }

  // ---- RENDER ----
  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-50">
        <div className="text-emerald-400 text-5xl mb-5 animate-pulse">📡</div>
        <h3 className="text-white text-lg font-bold">{loaderText}</h3>
      </div>
    )
  }

  // LOGIN SCREEN
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
          maxLength={4} />

        <button onClick={handleClockIn}
          className="w-full max-w-sm bg-gradient-to-r from-emerald-500 to-emerald-700 p-5 rounded-xl text-white font-black text-lg shadow-lg">
          🕐 CLOCK IN & START
        </button>
      </div>
    )
  }

  // JOBS SCREEN
  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      <Toaster position="top-center" />

      {/* App Bar */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-50 px-5 py-4 border-b border-slate-700 flex justify-between items-center">
        <div className="font-bold text-lg flex items-center gap-2">
          <span className="text-slate-400">👤</span> {state.driver}
        </div>
        <div className="flex items-center gap-3">
          <div onClick={() => loadJobs()} className="bg-emerald-500 text-black px-4 py-1.5 rounded-full font-extrabold text-sm cursor-pointer shadow">
            ↻ {jobs.length} Jobs
          </div>
          <button onClick={handleClockOut} className="text-red-400 text-xl">🚪</button>
        </div>
      </div>

      {/* Job List */}
      <div className="p-4 space-y-5">
        {jobs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold">Route Complete</h3>
            <p className="text-slate-400">No active jobs.</p>
          </div>
        ) : (
          jobs.map(job => <DriverJobCard key={job.id} job={job} config={DEFAULT_CONFIG} onComplete={handleComplete} onAbort={handleAbort} />)
        )}
      </div>
    </div>
  )
}

// ---- DRIVER JOB CARD ----
function DriverJobCard({ job, config, onComplete, onAbort }: any) {
  const [skipId, setSkipId] = useState('')
  const [showAbort, setShowAbort] = useState(false)
  const [abortReason, setAbortReason] = useState('')
  const [photoTaken, setPhotoTaken] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | undefined>()

  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(job.address)}`
  const borderColor = job.job_type === 'Delivery' ? 'border-t-emerald-500' : job.job_type === 'Collection' ? 'border-t-red-500' : 'border-t-amber-500'
  const typeColor = job.job_type === 'Delivery' ? 'text-emerald-400' : job.job_type === 'Collection' ? 'text-red-400' : 'text-amber-400'

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Upload to Supabase Storage
    const path = `proofs/${job.id}-${Date.now()}.jpg`
    const { data, error } = await supabase.storage.from('job-photos').upload(path, file)
    if (error) { toast.error('Photo upload failed'); return }
    const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(data.path)
    setPhotoUrl(urlData.publicUrl)
    setPhotoTaken(true)
    toast.success('📸 Photo attached!')
  }

  return (
    <div className={`bg-slate-800 rounded-2xl p-5 border-t-[6px] ${borderColor} shadow-xl`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className={`text-xl font-black ${typeColor}`}>{job.job_type} <span className="text-slate-400">{job.skip_size}yd</span></h3>
        <div className="flex gap-2">
          <button onClick={() => setShowAbort(!showAbort)} className="text-red-400 bg-slate-700 px-3 py-1 rounded-lg text-sm">⛔</button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <a href={wazeUrl} target="_blank" className="flex-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-xl text-center text-sm font-bold">
          🗺️ Waze
        </a>
        <a href={`tel:${config.officePhone}`} className="flex-1 bg-slate-700 px-3 py-2 rounded-xl text-center text-sm font-bold">
          🏢 Office
        </a>
        {job.phone && (
          <a href={`tel:${job.phone}`} className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-xl text-center text-sm font-bold">
            📞 Cust
          </a>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex gap-3 text-slate-300"><span className="text-red-400">📍</span> <strong>{job.address}</strong></div>
        <div className="flex gap-3 text-slate-300"><span className="text-blue-400">👤</span> {job.customer_name}</div>
      </div>

      {job.delivery_comments && (
        <div className="bg-white/5 p-3 rounded-lg text-sm mb-4 border-l-4 border-amber-500">📝 {job.delivery_comments}</div>
      )}

      {/* Abort Section */}
      {showAbort && (
        <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/30 mb-4">
          <h4 className="text-red-400 font-bold mb-2">Failed Delivery / Abort</h4>
          <input type="text" value={abortReason} onChange={e => setAbortReason(e.target.value)}
            placeholder="Reason (e.g. Gate locked)" className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 mb-3" />
          <div className="flex gap-2">
            <button onClick={() => onAbort(job.id, abortReason)} className="flex-1 bg-red-600 py-3 rounded-lg font-bold">Confirm</button>
            <button onClick={() => setShowAbort(false)} className="flex-1 bg-slate-600 py-3 rounded-lg font-bold">Cancel</button>
          </div>
        </div>
      )}

      {/* Photo + Complete */}
      <div className="mt-4 space-y-3">
        <label className="block bg-slate-700 p-3 rounded-xl text-center cursor-pointer font-bold text-sm hover:bg-slate-600 transition">
          📸 {photoTaken ? '✅ Photo Attached' : 'Take Photo'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
        </label>

        <input type="text" value={skipId} onChange={e => setSkipId(e.target.value)}
          placeholder={`Skip ID ${job.hint ? `(Hint: ${job.hint})` : ''}`}
          className="w-full p-4 rounded-xl bg-slate-900 border-2 border-slate-600 text-lg font-semibold" />

        <button onClick={() => onComplete(job, skipId, photoUrl)}
          disabled={!photoTaken}
          className={`w-full py-4 rounded-xl font-black text-lg transition shadow-lg ${photoTaken ? 'bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600' : 'bg-slate-600 opacity-50'}`}>
          {photoTaken ? '✅ COMPLETE JOB' : '🔒 TAKE PHOTO FIRST'}
        </button>
      </div>
    </div>
  )
}
