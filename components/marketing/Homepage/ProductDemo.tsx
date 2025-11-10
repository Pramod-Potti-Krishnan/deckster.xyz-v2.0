'use client';

import { Button } from '@/components/ui/button';
import { Play, MessageSquare, Presentation } from 'lucide-react';
import { motion } from 'framer-motion';

export function ProductDemo() {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              See deckster in Action
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Watch how our multi-agent AI system creates professional presentations in minutes.
              From initial prompt to final export, experience the future of presentation creation.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Natural Conversation</h3>
                  <p className="text-sm text-muted-foreground">
                    Chat with AI agents like you would with a team member
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Presentation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Real-time Preview</h3>
                  <p className="text-sm text-muted-foreground">
                    Watch slides generate live as agents collaborate
                  </p>
                </div>
              </div>
            </div>

            <Button size="lg" variant="outline">
              <Play className="mr-2 h-5 w-5" />
              Watch 2-Minute Demo
            </Button>
          </motion.div>

          {/* Right: Demo Placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/40 flex items-center justify-center overflow-hidden">
              {/* Placeholder - Replace with actual demo video/gif */}
              <div className="text-center p-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                  <Play className="h-10 w-10 text-white" />
                </div>
                <p className="text-lg font-semibold mb-2">Product Demo</p>
                <p className="text-sm text-muted-foreground">
                  Coming soon: Interactive demo video
                </p>
              </div>

              {/* Example of what could be here: Animated screenshot carousel */}
              {/* Or embedded video player */}
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-72 h-72 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
