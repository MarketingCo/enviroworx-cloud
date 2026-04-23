'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getLorries, getDriversList, updateDriverPin } from '@/lib/api'
import { Badge, SectionHeader, DEFAULT_CONFIG } from './shared'
import toast from 'react-hot-toast'
import { Wrench, Truck, AlertTriangle, CheckCircle, Settings, Clock, X, Plus } from 'lucide-react'
function FleetTab() {
  const [lorries, setLorries] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [showLogIssue, setShowLogIssue] = useState(false)
  const [issueForm, setIssueForm] = useState({ lorry_reg: '', issue_type: 'Mechanical', description: '', reported_by: '' })
  const [savingIssue, setSavingIssue] = useState(false)

  async function load() {
    const [lorryData, driverData, { data: issueData }] = await Promise.all([
      getLorries(),
      getDriversList(),
      supabase.from('fleet_logs').select('*').eq('status', 'Open').order('created_at', { ascending: false }),
    ])
    setLorries(lorryData)
    setDrivers(driverData)
    setIssues(issueData ?? [])
  }

  useEffect(() => { load() }, [])

  async function handlePinChange(id: string, newPin: string) {
    if (newPin.length !== 4) return
    try {
      await updateDriverPin(id, newPin)
      toast.success('PIN Updated')
      load()
    } catch (e: any) {
      toast.error('Failed: ' + e.message)
    }
  }

  function motDays(dateStr: string | null): number | null {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  }

  function motColor(dateStr: string | null) {
    const d = motDays(dateStr)
    if (d === null) return 'text-slate-500'
    if (d < 0) return 'text-red-400'
    if (d < 30) return 'text-yellow-400'
    return 'text-green-400'
  }

  async function logIssue() {
    if (!issueForm.lorry_reg.trim() || !issueForm.description.trim()) return
    setSavingIssue(true)
    await supabase.from('fleet_logs').insert({
      lorry_reg: issueForm.lorry_reg.trim(),
      issue_type: issueForm.issue_type,
      description: issueForm.description.trim(),
      reported_by: issueForm.reported_by.trim() || 'Office',
      status: 'Open',
    })
    toast.success('Issue logged')
    setShowLogIssue(false)
    setIssueForm({ lorry_reg: '', issue_type: 'Mechanical', description: '', reported_by: '' })
    setSavingIssue(false)
    load()
  }

  async function resolveIssue(id: string) {
    await supabase.from('fleet_logs').update({ status: 'Resolved', resolved_at: new Date().toISOString() }).eq('id', id)
    toast.success('Issue resolved')
    load()
  }

  const alertVehicles = lorries.filter(l => {
    const mot = motDays(l.mot_due)
    const tax = motDays(l.tax_due)
    return (mot !== null && mot < 30) || (tax !== null && tax < 30)
  })

  return (
    <div className="space-y-6">
      {/* Compliance alerts */}
      {alertVehicles.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-400 font-black text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
            <AlertTriangle size={14} /> Compliance Alerts ({alertVehicles.length})
          </p>
          <div className="space-y-1">
            {alertVehicles.map(l => {
              const mot = motDays(l.mot_due)
              const tax = motDays(l.tax_due)
              return (
                <p key={l.id} className="text-xs text-yellow-300">
                  {l.registration}:
                  {mot !== null && mot < 30 && <span className="ml-2">MOT {mot < 0 ? `EXPIRED ${Math.abs(mot)}d ago` : `due in ${mot}d`}</span>}
                  {tax !== null && tax < 30 && <span className="ml-2">Tax {tax < 0 ? `EXPIRED ${Math.abs(tax)}d ago` : `due in ${tax}d`}</span>}
                </p>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Lorry Fleet */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title={`Fleet (${lorries.length} vehicles)`} />
          <div className="space-y-3">
            {lorries.length === 0 && <p className="text-slate-500 text-sm">No vehicles on record</p>}
            {lorries.map((l: any) => (
              <div key={l.id} className="border border-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-white">{l.registration}</span>
                  <Badge label={l.status || 'Active'} color={l.status === 'Off Road' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">MOT: </span>
                    <span className={motColor(l.mot_due)}>
                      {l.mot_due
                        ? `${l.mot_due}${motDays(l.mot_due) !== null ? ` (${motDays(l.mot_due)! < 0 ? 'EXPIRED' : motDays(l.mot_due) + 'd'})` : ''}`
                        : 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tax: </span>
                    <span className={motColor(l.tax_due)}>
                      {l.tax_due
                        ? `${l.tax_due}${motDays(l.tax_due) !== null ? ` (${motDays(l.tax_due)! < 0 ? 'EXPIRED' : motDays(l.tax_due) + 'd'})` : ''}`
                        : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Management */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5 shadow-xl">
          <SectionHeader title={`Drivers (${drivers.length})`} />
          <div className="space-y-3">
            {drivers.length === 0 && <p className="text-slate-500 text-sm">No drivers registered</p>}
            {drivers.map((d: any) => (
              <div key={d.id} className="border border-white/5 rounded-lg p-4 bg-slate-950/30 flex items-center justify-between group">
                <div>
                  <p className="font-black text-white text-sm">{d.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'Available' ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{d.status || 'Offline'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Access PIN</label>
                  <input
                    type="password"
                    defaultValue={d.pin}
                    maxLength={4}
                    onBlur={(e) => {
                      if (e.target.value !== d.pin) handlePinChange(d.id, e.target.value)
                    }}
                    className="bg-slate-900 border border-white/10 text-primary font-black text-center tracking-[0.5em] w-20 py-1 rounded text-sm focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open Issues */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title={`Open Issues (${issues.length})`} />
            <button
              onClick={() => setShowLogIssue(!showLogIssue)}
              className="text-xs font-black text-primary border border-primary/30 px-3 py-1 rounded hover:bg-primary/10 transition"
            >
              + Log Issue
            </button>
          </div>

          {showLogIssue && (
            <div className="bg-slate-800 rounded-lg p-4 mb-4 space-y-3 border border-white/5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Vehicle Reg</label>
                  <select
                    value={issueForm.lorry_reg}
                    onChange={e => setIssueForm(f => ({ ...f, lorry_reg: e.target.value }))}
                    className="w-full bg-slate-900 border border-white/10 text-white px-3 py-2 rounded text-sm focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {lorries.map(l => <option key={l.id}>{l.registration}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Issue Type</label>
                  <select
                    value={issueForm.issue_type}
                    onChange={e => setIssueForm(f => ({ ...f, issue_type: e.target.value }))}
                    className="w-full bg-slate-900 border border-white/10 text-white px-3 py-2 rounded text-sm focus:outline-none"
                  >
                    {['Mechanical', 'Electrical', 'Tyre', 'Body Damage', 'Safety', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Description</label>
                <input
                  type="text"
                  value={issueForm.description}
                  onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue..."
                  className="w-full bg-slate-900 border border-white/10 text-white px-3 py-2 rounded text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Reported By</label>
                <input
                  type="text"
                  value={issueForm.reported_by}
                  onChange={e => setIssueForm(f => ({ ...f, reported_by: e.target.value }))}
                  placeholder="Name"
                  className="w-full bg-slate-900 border border-white/10 text-white px-3 py-2 rounded text-sm focus:outline-none"
                />
              </div>
              <button
                onClick={logIssue}
                disabled={savingIssue}
                className="w-full bg-primary text-slate-900 font-black text-sm py-2 rounded hover:brightness-90 transition disabled:opacity-50"
              >
                {savingIssue ? 'Saving...' : 'Log Issue'}
              </button>
            </div>
          )}

          {issues.length === 0
            ? <p className="text-slate-500 text-sm">No open issues</p>
            : <div className="space-y-3">
                {issues.map((iss: any) => (
                  <div key={iss.id} className="border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-white">{iss.lorry_reg}</span>
                      <div className="flex items-center gap-2">
                        <Badge label={iss.issue_type} color="bg-red-900/40 text-red-400" />
                        <button
                          onClick={() => resolveIssue(iss.id)}
                          className="text-[10px] font-black text-green-400 border border-green-500/30 px-2 py-0.5 rounded hover:bg-green-900/20 transition"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">{iss.description}</p>
                    <p className="text-xs text-slate-500 mt-1">Reported by {iss.reported_by}</p>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

export default FleetTab
