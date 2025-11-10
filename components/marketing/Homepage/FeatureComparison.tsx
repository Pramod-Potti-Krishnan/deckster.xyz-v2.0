'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  { feature: 'AI-Powered Content', deckster: true, traditional: false },
  { feature: 'Multi-Agent Collaboration', deckster: true, traditional: false },
  { feature: 'Real-time Generation', deckster: true, traditional: false },
  { feature: 'Transparent Workflow', deckster: true, traditional: false },
  { feature: 'Professional Templates', deckster: true, traditional: true },
  { feature: 'Data Visualization', deckster: true, traditional: true },
  { feature: 'Manual Editing', deckster: true, traditional: true },
  { feature: 'Time to Create (avg)', deckster: '5 min', traditional: '2-3 hrs' },
];

export function FeatureComparison() {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose deckster?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how our AI-powered approach compares to traditional presentation tools
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto"
      >
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-1/2 font-semibold text-base">Feature</TableHead>
                <TableHead className="text-center font-semibold text-base">
                  <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    deckster
                  </span>
                </TableHead>
                <TableHead className="text-center font-semibold text-base text-muted-foreground">
                  Traditional Tools
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((item, index) => (
                <TableRow key={index} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{item.feature}</TableCell>
                  <TableCell className="text-center">
                    {typeof item.deckster === 'boolean' ? (
                      item.deckster ? (
                        <div className="flex justify-center">
                          <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-1">
                            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-1">
                            <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                        </div>
                      )
                    ) : (
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {item.deckster}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {typeof item.traditional === 'boolean' ? (
                      item.traditional ? (
                        <div className="flex justify-center">
                          <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-1">
                            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-1">
                            <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                        </div>
                      )
                    ) : (
                      <span>{item.traditional}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </section>
  );
}
