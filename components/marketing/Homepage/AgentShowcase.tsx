'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Pencil, Palette, BarChart3, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const agents = [
  {
    name: 'Director',
    icon: Brain,
    role: 'Orchestration & Planning',
    description: 'The Director analyzes your goals and creates the perfect presentation structure. It decides which agents to involve and coordinates their collaboration.',
    capabilities: ['Strategic Planning', 'Agent Coordination', 'Content Structure'],
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
  {
    name: 'Scripter',
    icon: Pencil,
    role: 'Content & Copywriting',
    description: 'The Scripter crafts compelling narratives and persuasive copy. It writes slide content, speaker notes, and ensures your message resonates with your audience.',
    capabilities: ['Compelling Copy', 'Speaker Notes', 'Tone Adaptation'],
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  {
    name: 'Graphic Artist',
    icon: Palette,
    role: 'Visual Design & Layout',
    description: 'The Graphic Artist designs beautiful, professional layouts. It selects color schemes, arranges elements, and ensures visual consistency throughout your deck.',
    capabilities: ['Layout Design', 'Color Theory', 'Visual Hierarchy'],
    color: 'from-pink-500 to-pink-600',
    bgColor: 'bg-pink-100 dark:bg-pink-900/20',
    textColor: 'text-pink-700 dark:text-pink-300',
  },
  {
    name: 'Data Visualizer',
    icon: BarChart3,
    role: 'Charts & Data Insights',
    description: 'The Data Visualizer transforms numbers into insights. It creates charts, graphs, and data visualizations that make complex information easy to understand.',
    capabilities: ['Chart Creation', 'Data Analysis', 'Visual Analytics'],
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
  },
];

export function AgentShowcase() {
  return (
    <section className="container mx-auto px-4 py-20 bg-muted/40">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            Multi-Agent AI
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Meet Your AI Team</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Four specialized agents working together to create your perfect presentation
          </p>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-12">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center mb-4`}>
                  <agent.icon className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">{agent.name}</CardTitle>
                <CardDescription className="font-medium">{agent.role}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{agent.description}</p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Capabilities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map((capability) => (
                      <Badge
                        key={capability}
                        variant="secondary"
                        className={`${agent.bgColor} ${agent.textColor} text-xs`}
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
        <Button variant="outline" size="lg" asChild>
          <Link href="/agents">
            Learn More About Our Agents <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
