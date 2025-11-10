'use client';

import { MessageSquare, Cpu, Presentation } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    number: 1,
    icon: MessageSquare,
    title: 'Describe Your Presentation',
    description: 'Simply tell us what you need. Whether it\'s a pitch deck, sales presentation, or training material, just describe your goals in natural language.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    number: 2,
    icon: Cpu,
    title: 'AI Agents Collaborate',
    description: 'Watch our specialized agents work together. The Director plans the structure, Scripter writes compelling content, Graphic Artist designs layouts, and Data Visualizer creates charts.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    number: 3,
    icon: Presentation,
    title: 'Get Perfect Slides',
    description: 'Review your professional presentation in minutes. Edit inline, refine with AI assistance, and export in your preferred format. It\'s that simple.',
    color: 'from-indigo-500 to-indigo-600',
  },
];

export function HowItWorks() {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create professional presentations in three simple steps
          </p>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="relative"
          >
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/20 -z-10" />
            )}

            <div className="text-center">
              {/* Icon Circle */}
              <div className="relative mx-auto w-32 h-32 mb-6">
                <div className={`absolute inset-0 bg-gradient-to-br ${step.color} rounded-full opacity-10`} />
                <div className={`absolute inset-2 bg-gradient-to-br ${step.color} rounded-full flex items-center justify-center`}>
                  <step.icon className="h-12 w-12 text-white" />
                </div>
                {/* Step Number Badge */}
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-background border-2 border-primary rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{step.number}</span>
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
