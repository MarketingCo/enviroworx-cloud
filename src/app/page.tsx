'use client';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Truck, 
  MapPin, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Database, 
  Users, 
  FileSpreadsheet,
  ArrowUpRight,
  MonitorDot
} from 'lucide-react';
import Link from 'next/link';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: "circOut" as const }
};

const staggerContainer = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { staggerChildren: 0.1 }
};

export default function Home() {
  return (
    <div className="bg-slate-950 text-white min-h-screen selection:bg-brand-green selection:text-white">
      {/* Dynamic Grid Background */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950"></div>
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-green rounded flex items-center justify-center font-black italic tracking-tighter text-sm">E</div>
            <span className="text-lg font-black italic tracking-tighter uppercase">Enviroworx<span className="text-brand-green">Cloud</span></span>
          </Link>
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              <Link href="#platform" className="hover:text-white transition-colors">Platform</Link>
              <Link href="#infrastructure" className="hover:text-white transition-colors">Infrastructure</Link>
              <Link href="/login" className="text-white border-l border-white/10 pl-8">Login</Link>
            </nav>
            <Link href="#contact" className="bg-white text-slate-950 px-6 py-2 rounded font-black uppercase text-[10px] tracking-widest hover:bg-brand-green transition-all shadow-xl shadow-brand-green/10">
              Deploy Instance
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-48 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-10"
          >
            <div className="inline-flex items-center gap-2 bg-brand-green/10 border border-brand-green/20 px-4 py-1 rounded-full text-brand-green font-black uppercase text-[10px] tracking-[0.4em]">
               <MonitorDot size={14} /> Enterprise Core v4.0
            </div>
            <h1 className="text-7xl md:text-9xl font-black leading-[0.85] tracking-tighter uppercase italic">
              Total <br /> <span className="text-brand-green">Operational</span> <br /> Control.
            </h1>
            <p className="text-xl text-slate-400 font-light leading-relaxed max-w-lg border-l border-brand-green/30 pl-8 italic">
              The high-octane operating system for skip hire and waste logistics. Engineered for speed, designed for scale.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <Link href="/demo" className="group bg-brand-green text-white px-12 py-6 rounded font-black uppercase text-xs tracking-[0.3em] transition-all hover:translate-x-2 flex items-center justify-center gap-4 shadow-2xl shadow-brand-green/20">
                Book Live Demo <ArrowUpRight size={18} />
              </Link>
              <Link href="#infrastructure" className="bg-white/5 border border-white/10 text-white px-12 py-6 rounded font-black uppercase text-xs tracking-[0.3em] transition-all hover:bg-white/10 text-center">
                System Specs
              </Link>
            </div>
          </motion.div>

          {/* Animated Dashboard Teaser */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="relative"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
                <div className="h-8 bg-slate-800 flex items-center px-4 gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                    <div className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest">LIVE_DISPATCH_CORE</div>
                </div>
                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-24 bg-slate-800/50 rounded-lg animate-pulse"></div>
                        ))}
                    </div>
                    <div className="space-y-4">
                        <div className="h-4 w-full bg-slate-800/50 rounded animate-pulse"></div>
                        <div className="h-4 w-2/3 bg-slate-800/50 rounded animate-pulse"></div>
                        <div className="h-4 w-1/2 bg-slate-800/50 rounded animate-pulse"></div>
                    </div>
                    <div className="h-40 bg-slate-800 border border-white/5 rounded-lg flex items-center justify-center">
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="text-brand-green/20"
                        >
                            <Zap size={80} />
                        </motion.div>
                    </div>
                </div>
            </div>
            {/* Floating Elements */}
            <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-10 -right-10 bg-brand-green p-6 rounded-2xl shadow-2xl rotate-12"
            >
                <Truck size={32} className="text-slate-950" />
            </motion.div>
            <motion.div 
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                className="absolute -bottom-10 -left-10 bg-white p-6 rounded-2xl shadow-2xl -rotate-12"
            >
                <BarChart3 size={32} className="text-brand-green" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Platform Core Features */}
      <section id="platform" className="relative z-10 py-40 border-y border-white/5 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-6">
            <motion.div {...fadeInUp} className="text-center mb-32 space-y-6">
                <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter italic">Platform <span className="text-brand-green">Core</span></h2>
                <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-xs">A unified ecosystem for modern waste management</p>
            </motion.div>

            <motion.div 
                variants={staggerContainer}
                initial="initial"
                whileInView="whileInView"
                viewport={{ once: true }}
                className="grid md:grid-cols-3 gap-12"
            >
                {[
                    { icon: <Database />, title: "Live Dispatch", desc: "Drag-and-drop job allocation with real-time driver sync." },
                    { icon: <FileSpreadsheet />, title: "Digital WTNs", desc: "Automated Waste Transfer Notes and SEPA reporting." },
                    { icon: <Users />, title: "Customer Portal", desc: "White-labeled portal for client booking and history." },
                    { icon: <MapPin />, title: "Route Optimization", desc: "Al-driven route mapping to minimize fuel and maximize time." },
                    { icon: <ShieldCheck />, title: "Compliance Hub", desc: "Driver daily checks, vehicle maintenance logs, and health audits." },
                    { icon: <MonitorDot />, title: "BI Dashboard", desc: "Precision analytics on tonnage, margins, and operational health." },
                ].map((item, i) => (
                    <motion.div 
                        key={i}
                        variants={fadeInUp}
                        className="p-12 bg-slate-900 border border-white/5 hover:border-brand-green/50 transition-all group"
                    >
                        <div className="text-brand-green mb-8 group-hover:scale-110 transition-transform">{item.icon}</div>
                        <h3 className="text-xl font-black uppercase tracking-tighter italic mb-4">{item.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                    </motion.div>
                ))}
            </motion.div>
        </div>
      </section>

      {/* Infrastructure Section */}
      <section id="infrastructure" className="relative z-10 py-40 bg-slate-900/30 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-32 items-center">
            <motion.div {...fadeInUp} className="space-y-12">
                <h2 className="text-6xl font-black uppercase italic tracking-tighter leading-none text-white">
                    Engineered <br /> for <span className="text-brand-green italic underline decoration-brand-green/20 underline-offset-8">Resilience</span>
                </h2>
                <div className="space-y-10">
                    <div className="flex gap-8 group">
                        <div className="w-12 h-12 bg-brand-green rounded-full flex items-center justify-center text-slate-950 font-black italic">01</div>
                        <div>
                            <h4 className="font-black uppercase tracking-widest text-xs mb-2">Supabase Infrastructure</h4>
                            <p className="text-slate-500 text-sm leading-relaxed">Global redundancy with lightning-fast PostgreSQL performance.</p>
                        </div>
                    </div>
                    <div className="flex gap-8 group">
                        <div className="w-12 h-12 bg-brand-green rounded-full flex items-center justify-center text-slate-950 font-black italic">02</div>
                        <div>
                            <h4 className="font-black uppercase tracking-widest text-xs mb-2">Real-time Sync</h4>
                            <p className="text-slate-500 text-sm leading-relaxed">Office, drivers, and yard always in perfect synchronization.</p>
                        </div>
                    </div>
                    <div className="flex gap-8 group">
                        <div className="w-12 h-12 bg-brand-green rounded-full flex items-center justify-center text-slate-950 font-black italic">03</div>
                        <div>
                            <h4 className="font-black uppercase tracking-widest text-xs mb-2">API Integration</h4>
                            <p className="text-slate-500 text-sm leading-relaxed">Seamlessly link with accounting, weighbridge, and telematics systems.</p>
                        </div>
                    </div>
                </div>
            </motion.div>
            <motion.div 
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-slate-950 p-12 border border-brand-green/20 shadow-3xl rounded-3xl"
            >
                <div className="space-y-8">
                    <div className="flex justify-between items-end border-b border-white/5 pb-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">System Health</span>
                        <span className="text-brand-green font-black italic tracking-tighter">OPERATIONAL_OK</span>
                    </div>
                    <div className="space-y-6">
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                whileInView={{ width: "98%" }}
                                transition={{ duration: 1.5, delay: 0.5 }}
                                className="h-full bg-brand-green"
                            ></motion.div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span>Uptime Reliability</span>
                            <span>99.9%</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 bg-white/5 border border-white/5 rounded-xl">
                            <Clock size={20} className="text-brand-green mb-4" />
                            <p className="text-xs font-bold text-slate-500 uppercase">Avg Response</p>
                            <p className="text-2xl font-black italic tracking-tighter">45ms</p>
                        </div>
                        <div className="p-6 bg-white/5 border border-white/5 rounded-xl">
                            <Database size={20} className="text-brand-green mb-4" />
                            <p className="text-xs font-bold text-slate-500 uppercase">DB Core</p>
                            <p className="text-2xl font-black italic tracking-tighter">Encrypted</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </section>

      {/* Deployment Contact */}
      <section id="contact" className="relative z-10 py-40 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-16">
            <motion.div {...fadeInUp} className="space-y-8">
                <h2 className="text-7xl md:text-9xl font-black uppercase tracking-tighter italic leading-[0.85]">
                    Deploy <br /> <span className="text-brand-green italic underline decoration-white underline-offset-8">Cloud</span> <br /> Now
                </h2>
                <p className="text-2xl text-slate-500 font-light max-w-2xl mx-auto italic">
                    Ready to modernize your operations? Schedule a structural audit of your current system and receive a deployment roadmap.
                </p>
            </motion.div>
            <div className="flex justify-center pt-10">
                <Link href="/apply" className="group bg-white text-slate-950 px-24 py-8 rounded font-black uppercase text-xs tracking-[0.5em] transition-all hover:bg-brand-green hover:scale-105 flex items-center gap-8 shadow-[0_30px_60px_rgba(46,125,50,0.2)]">
                    Start Integration <Zap size={24} fill="currentColor" />
                </Link>
            </div>
        </div>
      </section>

      {/* Footer Minimal */}
      <footer className="relative z-10 py-20 border-t border-white/5 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-10">
            <Link href="/" className="inline-block">
                <span className="text-xl font-black italic tracking-tighter uppercase">ENVIRO<span className="text-brand-green">WORX</span> CLOUD</span>
            </Link>
            <p className="text-slate-600 font-bold uppercase tracking-[0.5em] text-[10px]">&copy; {new Date().getFullYear()} Enviroworx Enterprise Systems. Engineered for Speed.</p>
        </div>
      </footer>
    </div>
  );
}