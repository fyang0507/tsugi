'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Terminal, Brain, Repeat, Layers } from 'lucide-react';
import { StepProps } from './types';

const steps: StepProps[] = [
  {
    number: "01",
    title: "Execute",
    description: "The agent attempts a task out of the box. It might detour and self-correct.",
    icon: Terminal
  },
  {
    number: "02",
    title: "Learn",
    description: "Upon success, tsugi analyzes the trace. It strips away the dead ends and identifies the critical path.",
    icon: Brain
  },
  {
    number: "03",
    title: "Reuse",
    description: "The successful procedure is codified into a skill. Next time, the agent retrieves this skill.",
    icon: Repeat
  },
  {
    number: "04",
    title: "Compound",
    description: "Agents build a library of executable capabilities that grows over time.",
    icon: Layers
  }
];

export const HowItWorks: React.FC = () => {
  return (
    <section className="pt-12 pb-24 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Never waste an exprience. </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            tsugi enables an agent to memorize procedures, not facts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <step.icon size={80} />
              </div>

              <div className="relative z-10">
                <span className="text-xs font-mono text-teal-400 mb-4 block tracking-wider">STEP {step.number}</span>
                <h3 className="text-xl font-bold mb-3 text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-teal-400 group-hover:to-cyan-400 transition-all">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
