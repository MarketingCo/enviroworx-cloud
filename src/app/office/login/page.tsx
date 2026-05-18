'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

/**
 * Office Login — Supabase Auth (email + password)
 *
 * Authenticates via Supabase Auth, then looks up the user's role
 * in the yard_staff or drivers table via auth_user_id.
 */

interface UserRole {
  name: string
  id: string
  role: 'driver' | 'yard' | 'office' | 'admin'
}

export default function OfficeLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      toast.error('Enter your email and password')
      return
    }
    setLoading(true)

    // Step 1: Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    if (authError || !authData.user) {
      toast.error(authError?.message || 'Invalid email or password')
      setLoading(false)
      return
    }

    // Step 2: Look up user's role via auth_user_id
    const authUserId = authData.user.id
    let userRole: UserRole | null = null

    // Check yard_staff table
    const { data: yardStaff } = await supabase
      .from('yard_staff')
      .select('id, name, role')
      .eq('auth_user_id', authUserId)
      .single()

    if (yardStaff) {
      userRole = {
        name: yardStaff.name,
        id: yardStaff.id,
        role: (yardStaff.role as UserRole['role']) || 'yard',
      }
    }

    // Check drivers table
    if (!userRole) {
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('auth_user_id', authUserId)
        .single()

      if (driver) {
        userRole = {
          name: driver.name,
          id: driver.id,
          role: 'driver',
        }
      }
    }

    if (!userRole) {
      // User is authenticated but has no linked staff/driver record
      // Still allow access as an office user if email is confirmed
      const isConfirmed = authData.user.email_confirmed_at != null
      if (!isConfirmed) {
        toast.error('Account not yet approved. Contact the office.')
        setLoading(false)
        return
      }
      // Allow through as office user with auth identity
      userRole = {
        name: authData.user.email?.split('@')[0] || 'User',
        id: authData.user.id,
        role: 'office',
      }
    }

    // Step 3: Store session in sessionStorage (clears on tab close)
    sessionStorage.setItem('office_session', JSON.stringify({
      name: userRole.name,
      id: userRole.id,
      role: userRole.role,
      authUserId: authData.user.id,
      loginAt: Date.now(),
    }))

    toast.success(`Welcome, ${userRole.name}!`)
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
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoFocus
              autoComplete="email"
              className="w-full bg-slate-800 border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleLogin(e as any)}
              className="w-full bg-slate-800 border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:border-primary focus:outline-none transition-colors"
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
