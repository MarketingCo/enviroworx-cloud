'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

// Simple staff auth — matches against drivers/yard_staff tables with PIN
// For production, swap to Supabase Auth with email+password

export default function OfficeLogin() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || pin.length < 4) {
      toast.error('Enter your name and 4-digit PIN')
      return
    }
    setLoading(true)

    const res = await fetch('/api/auth/office', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), pin: pin.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Invalid credentials')
      setLoading(false)
      return
    }

    sessionStorage.setItem('office_session', JSON.stringify({
      name: data.user.name,
      id: data.user.id,
      role: data.user.role,
      loginAt: Date.now(),
    }))

    router.push('/office')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center font-black italic text-xl text-white mx-auto mb-4">E</div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Enviroworx</h1>
          <p className="text-slate-500 text-sm mt-1 font-bold uppercase tracking-widest">Office System</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-900 border border-white/5 rounded-2xl p-8 space-y-5">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
              className="w-full bg-slate-800 border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">PIN</label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit PIN"
              inputMode="numeric"
              maxLength={4}
              onKeyDown={e => e.key === 'Enter' && handleLogin(e as any)}
              className="w-full bg-slate-800 border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:border-primary focus:outline-none transition-colors tracking-[0.5em] text-center text-xl"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-black uppercase tracking-widest text-sm transition-all disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 flex justify-center gap-4">
          <a href="/driver" className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-bold uppercase tracking-widest">Driver App</a>
          <span className="text-slate-700">·</span>
          <a href="/portal" className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-bold uppercase tracking-widest">Customer Portal</a>
        </div>
      </div>
    </div>
  )
}
