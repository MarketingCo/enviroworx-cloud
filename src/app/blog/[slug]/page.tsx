import { posts } from '@/data/posts';
import { notFound } from 'next/navigation';
import { Clock, ArrowLeft, Zap } from 'lucide-react';
import Link from 'next/link';

export async function generateStaticParams() {
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="bg-slate-950 text-white min-h-screen">
      <div className="h-24 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl"></div>
      
      <article className="relative z-10 py-32 px-6">
        <div className="max-w-3xl mx-auto space-y-16">
          <Link href="/blog" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 hover:text-brand-green transition-colors group">
            <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform text-brand-green" /> Back to Journal
          </Link>

          <div className="space-y-8">
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                <span className="flex items-center gap-2"><Clock size={12} className="text-brand-green" /> {post.date}</span>
                <span className="bg-white/5 px-3 py-1 rounded text-white">{post.category}</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter italic leading-none text-white">
              {post.title}
            </h1>
          </div>

          <div className="space-y-10 text-2xl text-slate-400 leading-relaxed font-light italic border-l-4 border-brand-green pl-10">
            {post.excerpt}
          </div>

          <div className="space-y-12 text-xl text-slate-300 leading-loose font-light">
            {post.content.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div className="pt-20 border-t border-white/5">
            <div className="bg-slate-900 p-16 space-y-10 text-center rounded-[40px] border border-white/5">
                <h3 className="text-4xl font-black uppercase tracking-tighter italic">Modernise Your Fleet.</h3>
                <p className="text-slate-400 max-w-lg mx-auto italic">Book a systems audit today and see the future of waste logistics in action.</p>
                <div className="flex justify-center">
                    <Link href="/demo" className="inline-flex items-center gap-6 bg-white text-slate-950 px-16 py-6 rounded font-black uppercase text-xs tracking-[0.4em] hover:bg-brand-green transition-all shadow-3xl">
                        Schedule Demo <Zap size={20} fill="currentColor" />
                    </Link>
                </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}