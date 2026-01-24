'use client';

import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Footer } from '@/components/landing/Footer';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';

export default function LandingPage() {
  return (
    <div className="min-h-screen text-foreground antialiased selection:bg-cyan-500/30 relative overflow-x-hidden">
      {/* Background Layer */}
      <FloatingOrbs />

      {/* Content Layer */}
      <div className="relative z-10">
        <Header />
        <main>
          <Hero />
          <HowItWorks />

          {/* Tech Stack / Social Proof */}
          <section className="py-24">
             <div className="container mx-auto px-6 text-center">
               <p className="text-sm md:text-base font-mono text-zinc-500 mb-12 uppercase tracking-widest">BUILT WITH</p>

               <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-4 items-start justify-center">

                  {/* Gemini 3 */}
                  <div className="flex flex-col items-center gap-3 group">
                      <div className="h-10 flex items-center justify-center">
                        <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">Gemini 3</span>
                      </div>
                      <span className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-wider border-t border-white/10 pt-2 w-24">Core LLM</span>
                  </div>

                  {/* Google AI Studio */}
                  <div className="flex flex-col items-center gap-3 group">
                      <div className="h-10 flex items-center justify-center">
                         <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">Google AI Studio</span>
                      </div>
                      <span className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-wider border-t border-white/10 pt-2 w-24">Design</span>
                  </div>

                  {/* Vercel */}
                  <div className="flex flex-col items-center gap-3 group">
                      <div className="h-10 flex items-center justify-center">
                          <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">Vercel</span>
                      </div>
                      <span className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-wider border-t border-white/10 pt-2 w-auto px-2">AI SDK & Hosting</span>
                  </div>

                  {/* Claude Code */}
                  <div className="flex flex-col items-center gap-3 group">
                      <div className="h-10 flex items-center justify-center">
                          <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">Claude Code</span>
                      </div>
                      <span className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-wider border-t border-white/10 pt-2 w-24">Development</span>
                  </div>

                  {/* Braintrust */}
                  <div className="flex flex-col items-center gap-3 group">
                      <div className="h-10 flex items-center justify-center">
                         <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">Braintrust</span>
                      </div>
                      <span className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-wider border-t border-white/10 pt-2 w-24">Observability</span>
                  </div>

               </div>
             </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
}
