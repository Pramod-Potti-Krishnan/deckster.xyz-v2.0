'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { FileText, Users, Clock, Sparkles } from 'lucide-react';

const stats = [
  {
    icon: FileText,
    value: 10000,
    suffix: '+',
    label: 'Presentations Created',
    description: 'Professional decks generated',
  },
  {
    icon: Users,
    value: 2500,
    suffix: '+',
    label: 'Happy Users',
    description: 'Across 50+ countries',
  },
  {
    icon: Clock,
    value: 75,
    suffix: '%',
    label: 'Time Saved',
    description: 'Compared to manual creation',
  },
  {
    icon: Sparkles,
    value: 4,
    suffix: '',
    label: 'AI Agents',
    description: 'Working together for you',
  },
];

function CountUpAnimation({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    const duration = 2000; // 2 seconds

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function (easeOutCubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * easeProgress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, target]);

  return (
    <span ref={ref} className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export function StatsSection() {
  return (
    <section className="container mx-auto px-4 py-20 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by Creators Worldwide</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of users who are creating better presentations faster
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="text-center"
          >
            <div className="mb-4 flex justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <stat.icon className="h-8 w-8 text-white" />
              </div>
            </div>
            <CountUpAnimation target={stat.value} suffix={stat.suffix} />
            <h3 className="text-lg font-semibold mt-2 mb-1">{stat.label}</h3>
            <p className="text-sm text-muted-foreground">{stat.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
