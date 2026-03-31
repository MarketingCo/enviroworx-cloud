'use client';
import { posts } from '@/src/data/posts';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, MonitorDot } from 'lucide-react';

export default function BlogPage() {
  return (
    <div className="bg-slate-950 text-white min-h-screen">
      <div className="h-24 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl"></div>
      
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-24 space-y-8"
          >
            <div className="inline-flex items-center gap-3 bg-brand-green/10 border border-brand-green/20 px-4 py-1 rounded-full text-brand-green font-black uppercase text-[10px] tracking-[0.4em]">
               <MonitorDot size={14} /> The Cloud Journal
            </div>
            <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter italic leading-none">
              Operational <span className="text-brand-green">Insights</span>
            </h1>
            <p className="text-2xl text-slate-500 font-light max-w-2xl leading-relaxed italic border-l border-brand-green/30 pl-8">
              Deep dives into waste logistics, industrial automation, and sustainable infrastructure.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {posts.map((post, i) => (
              <motion.article 
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-slate-900 border border-white/5 p-12 hover:border-brand-green/50 transition-all"
              >
                <Link href={`/blog/${post.slug}`}>
                  <div className="space-y-10">
                    <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                        <span className="flex items-center gap-2"><Clock size={12} className="text-brand-green" /> {post.date}</span>
                        <span className="bg-white/5 px-3 py-1 rounded text-white">{post.category}</span>
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic leading-tight group-hover:text-brand-green transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-xl text-slate-400 font-light leading-relaxed">
                      {post.excerpt}
                    </p>
                    <div className="pt-6 flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-white group-hover:gap-8 transition-all">
                        Analyze System <ArrowRight size={16} className="text-brand-green" />
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}