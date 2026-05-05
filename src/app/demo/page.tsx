'use client'

import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center mx-auto">
          <Zap size={32} className="text-slate-950" />
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tighter italic">Live Demo</h1>
        <p className="text-slate-400">
          Demo scheduling is coming soon. Contact the office to arrange a live walkthrough of Enviroworx Cloud.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-brand-green font-black uppercase text-xs tracking-widest hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>
      </div>
    </div>
  )
}
