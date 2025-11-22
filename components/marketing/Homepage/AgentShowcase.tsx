'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Pencil, Palette, BarChart3, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const agents = [
  {
    name: 'Director',
    icon: Brain,
    role: 'Orchestration & Planning',
    description: 'Analyzes goals and creates the perfect presentation structure. Decides which agents to involve.',
    capabilities: ['Strategic Planning', 'Agent Coordination', 'Content Structure'],
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
  {
    name: 'Scripter',
    icon: Pencil,
    role: 'Content & Copywriting',
    description: 'Crafts compelling narratives and persuasive copy. Writes slide content and speaker notes.',
    capabilities: ['Compelling Copy', 'Speaker Notes', 'Tone Adaptation'],
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  {
    name: 'Graphic Artist',
    icon: Palette,
    role: 'Visual Design & Layout',
    description: 'Designs beautiful, professional layouts. Selects color schemes and arranges elements.',
    capabilities: ['Layout Design', 'Color Theory', 'Visual Hierarchy'],
    color: 'from-pink-500 to-pink-600',
    bgColor: 'bg-pink-100 dark:bg-pink-900/20',
    textColor: 'text-pink-700 dark:text-pink-300',
  },
  {
    name: 'Data Visualizer',
    icon: BarChart3,
    role: 'Charts & Data Insights',
    description: 'Transforms numbers into insights. Creates charts and data visualizations.',
    capabilities: ['Chart Creation', 'Data Analysis', 'Visual Analytics'],
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
  },
];

export function AgentShowcase() {
  return (
    <section className="container mx-auto px-4 py-32 bg-slate-50/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      <div className="text-center mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 px-4 py-1">
            <Sparkles className="w-3 h-3 mr-2 inline-block" />
            Multi-Agent AI
          </Badge>
          <h2 className="text-4xl font-bold mb-6">Meet Your AI Team</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Four specialized agents working together to create your perfect presentation
          </p>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-white/20 bg-white/60 backdrop-blur-sm">
              <CardHeader>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center mb-6 shadow-lg`}>
                  <agent.icon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold">{agent.name}</CardTitle>
                <CardDescription className="font-medium text-primary/80">{agent.role}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Capabilities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map((capability) => (
                      <Badge
                        key={capability}
                        variant="secondary"
                        className={`${agent.bgColor} ${agent.textColor} text-xs border-0`}
                      >
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-center"
      >
        <Button variant="outline" size="lg" className="rounded-full px-8 border-2" asChild>
          <Link href="/agents">
            Learn More About Our Agents <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
