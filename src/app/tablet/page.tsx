'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { clockInOutAction } from '@/app/actions/operations'
import toast, { Toaster } from 'react-hot-toast'

/**
 * TABLET APP (replaces TabletApp.html)
 * Yard punch clock for drivers/yard staff to clock in/out.
 * Runs on a wall-mounted tablet at the yard entrance.
 * Accessed at /tablet
 */

interface ShiftRow {
  id: string
  employee: string
  date: string
  clock_in: string | null
  clock_out: string | null
  role_or_lorry: string | null
  total_mins: number | null
  payable_hours: number | null
}

export default function TabletApp() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [yardStaff, setYardStaff] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [todayShifts, setTodayShifts] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Punch form
  const [selectedName, setSelectedName] = useState('')
  const [selectedLorry, setSelectedLorry] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'drivers' | 'yard'>('drivers')

  useEffect(() => {
    loadData()
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime shift updates
  useEffect(() => {
    const channel = supabase
      .channel('tablet-shifts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        loadTodayShifts()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadData() {
    const [{ data: drvs }, { data: ys }, { data: lors }] = await Promise.all([
      supabase.from('drivers_public' as 'drivers').select('id, name, status').order('name'),
      supabase.from('yard_staff_public' as 'yard_staff').select('id, name').order('name'),
      supabase.from('lorries').select('*').order('registration'),
    ])
    setDrivers(drvs ?? [])
    setYardStaff(ys ?? [])
    setLorries(lors ?? [])
    await loadTodayShifts()
    setLoading(false)
  }

  async function loadTodayShifts() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('date', today)
      .order('clock_in', { ascending: false })
    setTodayShifts((data ?? []) as ShiftRow[])
  }

  function isCurrentlyClockedIn(name: string) {
    return todayShifts.some(s => s.employee === name && !s.clock_out)
  }

  async function handlePunch() {
    if (!selectedName || !pin) return toast.error('Select name and enter PIN')
    setLoading(true)

    const clockedIn = isCurrentlyClockedIn(selectedName)
    const action = clockedIn ? 'OUT' : 'IN'

    try {
      const authRes = await fetch('/api/auth/tablet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedName, pin }),
      })
      if (!authRes.ok) {
        toast.error('Invalid PIN')
        setLoading(false)
        return
      }
      const result = await clockInOutAction(selectedName, pin, action, selectedLorry || undefined)
      if (result.success) {
        toast.success(result.message, { duration: 4000 })
        setPin('')
        setSelectedName('')
        setSelectedLorry('')
        await loadTodayShifts()
      } else {
        toast.error(result.message)
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    }
    setLoading(false)
  }

  const people = mode === 'drivers' ? drivers : yardStaff

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⏱️</div>
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Toaster position="top-center" toastOptions={{ style: { fontSize: '1.2rem', padding: '1rem 1.5rem' } }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 px-8 py-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">ENVIROWORX</h1>
          <p className="text-emerald-200 text-lg">Yard Time Clock</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-mono font-bold text-white">{currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-emerald-200">{currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* LEFT: Punch Clock */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => { setMode('drivers'); setSelectedName('') }}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition ${mode === 'drivers' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
              >
                🚛 Drivers
              </button>
              <button
                onClick={() => { setMode('yard'); setSelectedName('') }}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition ${mode === 'yard' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
              >
                🏗️ Yard Staff
              </button>
            </div>

            {/* Name Selection - Big Buttons for Tablet */}
            <p className="text-slate-400 text-sm font-bold mb-3">Select Your Name</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {people.map(p => {
                const name = p.name
                const clockedIn = isCurrentlyClockedIn(name)
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedName(name)}
                    className={`p-4 rounded-xl font-bold text-lg border-2 transition relative ${
                      selectedName === name
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-700 border-slate-600 text-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {name}
                    {clockedIn && <span className="absolute top-1 right-2 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">IN</span>}
                  </button>
                )
              })}
            </div>

            {/* Lorry (for drivers only) */}
            {mode === 'drivers' && (
              <>
                <p className="text-slate-400 text-sm font-bold mb-2">Lorry</p>
                <select
                  value={selectedLorry}
                  onChange={e => setSelectedLorry(e.target.value)}
                  className="w-full p-4 rounded-xl bg-slate-700 border border-slate-600 text-white text-lg font-bold mb-6"
                >
                  <option value="">-- Select Lorry --</option>
                  {lorries.map(l => (
                    <option key={l.id} value={l.registration}>{l.registration}</option>
                  ))}
                </select>
              </>
            )}

            {/* PIN */}
            <p className="text-slate-400 text-sm font-bold mb-2">Enter PIN</p>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="4-digit PIN"
              maxLength={4}
              className="w-full p-4 rounded-xl bg-slate-900 border-2 border-slate-600 text-white text-2xl font-mono text-center mb-6 focus:border-emerald-500 focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && handlePunch()}
            />

            {/* Punch Button */}
            {selectedName && (
              <button
                onClick={handlePunch}
                disabled={loading}
                className={`w-full py-5 rounded-xl font-black text-xl shadow-lg transition ${
                  isCurrentlyClockedIn(selectedName)
                    ? 'bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600'
                } disabled:opacity-50`}
              >
                {isCurrentlyClockedIn(selectedName) ? '🚪 CLOCK OUT' : '🕐 CLOCK IN'}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: Today's Shifts */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="bg-slate-700/50 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Today&apos;s Shifts</h2>
              <span className="text-emerald-400 font-bold">
                {todayShifts.filter(s => !s.clock_out).length} currently on site
              </span>
            </div>

            <div className="overflow-y-auto max-h-[70vh]">
              <table className="w-full">
                <thead className="bg-slate-700/30 sticky top-0">
                  <tr>
                    <th className="text-left p-4 text-slate-400 font-bold">Employee</th>
                    <th className="text-left p-4 text-slate-400 font-bold">Lorry/Role</th>
                    <th className="text-center p-4 text-slate-400 font-bold">Clock In</th>
                    <th className="text-center p-4 text-slate-400 font-bold">Clock Out</th>
                    <th className="text-center p-4 text-slate-400 font-bold">Hours</th>
                    <th className="text-center p-4 text-slate-400 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayShifts.map(s => {
                    const clockedIn = !s.clock_out
                    const hours = s.payable_hours ? s.payable_hours.toFixed(1) : clockedIn && s.clock_in
                      ? ((Date.now() - new Date(s.clock_in).getTime()) / 3600000).toFixed(1)
                      : '—'
                    return (
                      <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="p-4 font-bold text-lg">{s.employee}</td>
                        <td className="p-4 text-slate-300">{s.role_or_lorry || '—'}</td>
                        <td className="p-4 text-center font-mono text-emerald-400">
                          {s.clock_in ? new Date(s.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="p-4 text-center font-mono text-red-400">
                          {s.clock_out ? new Date(s.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="p-4 text-center font-bold">{hours}h</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            clockedIn ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'
                          }`}>
                            {clockedIn ? 'ON SITE' : 'FINISHED'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {todayShifts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 text-lg">No shifts logged today.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
