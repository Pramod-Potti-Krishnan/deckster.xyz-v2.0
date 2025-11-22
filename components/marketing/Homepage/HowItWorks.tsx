'use client';

import { MessageSquare, Cpu, Presentation } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    number: 1,
    icon: MessageSquare,
    title: 'Describe Your Vision',
    description: 'Simply tell us what you need. Whether it\'s a pitch deck, sales presentation, or training material, just describe your goals in natural language.',
    color: 'from-purple-500 to-purple-600',
    shadow: 'shadow-purple-500/25',
  },
  {
    number: 2,
    icon: Cpu,
    title: 'AI Agents Collaborate',
    description: 'Watch our specialized agents work together. The Director plans, Scripter writes, and Graphic Artist designs - all in perfect harmony.',
    color: 'from-blue-500 to-blue-600',
    shadow: 'shadow-blue-500/25',
  },
  {
    number: 3,
    icon: Presentation,
    title: 'Get Perfect Slides',
    description: 'Review your professional presentation in minutes. Edit inline, refine with AI assistance, and export in your preferred format.',
    color: 'from-indigo-500 to-indigo-600',
    shadow: 'shadow-indigo-500/25',
  },
];

export function HowItWorks() {
  return (
    <section className="container mx-auto px-4 py-32 relative">
      <div className="text-center mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold mb-6">How It Works</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create professional presentations in three simple steps
          </p>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto relative">
        {/* Connecting Line (Desktop) */}
        <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-purple-200 via-blue-200 to-indigo-200 -z-10" />

        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            className="relative group"
          >
            <div className="text-center">
              {/* Icon Circle */}
              <div className="relative mx-auto w-32 h-32 mb-8 transition-transform duration-300 group-hover:scale-110">
                <div className={`absolute inset-0 bg-gradient-to-br ${step.color} rounded-full opacity-20 blur-xl group-hover:opacity-30 transition-opacity`} />
                <div className={`absolute inset-0 bg-gradient-to-br ${step.color} rounded-full flex items-center justify-center shadow-lg ${step.shadow}`}>
                  <step.icon className="h-12 w-12 text-white" />
                </div>
                {/* Step Number Badge */}
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-white border-4 border-white rounded-full flex items-center justify-center shadow-md z-10">
                  <span className="text-lg font-bold text-slate-800">{step.number}</span>
                </div>
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
