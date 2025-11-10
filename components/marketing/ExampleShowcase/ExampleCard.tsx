'use client';

import { Example } from '@/types/example';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Star } from 'lucide-react';
import Link from 'next/link';

interface ExampleCardProps {
  example: Example;
  onViewExample?: (example: Example) => void;
}

const agentColors = {
  'director': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'scripter': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'graphic-artist': 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  'data-visualizer': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const agentNames = {
  'director': 'Director',
  'scripter': 'Scripter',
  'graphic-artist': 'Graphic Artist',
  'data-visualizer': 'Data Visualizer',
};

const complexityColors = {
  'basic': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'intermediate': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'advanced': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const industryColors = {
  'technology': 'bg-blue-500',
  'marketing': 'bg-pink-500',
  'sales': 'bg-green-500',
  'education': 'bg-indigo-500',
  'analytics': 'bg-purple-500',
  'creative': 'bg-orange-500',
  'non-profit': 'bg-teal-500',
};

export function ExampleCard({ example, onViewExample }: ExampleCardProps) {
  const handleViewExample = () => {
    if (onViewExample) {
      onViewExample(example);
    } else {
      // Default: navigate to example detail page
      window.location.href = `/examples/${example.id}`;
    }
  };

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Thumbnail */}
      <div className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br ${industryColors[example.industry]} to-blue-600`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-white p-6">
          <FileText className="h-16 w-16 mb-2 opacity-90" />
          <p className="text-sm font-medium capitalize">{example.industry}</p>
          <p className="text-xs opacity-75 capitalize">{example.useCase.replace('-', ' ')}</p>
        </div>

        {/* Badges overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {example.featured && (
            <Badge className="bg-yellow-500 text-white shadow-md">
              <Star className="h-3 w-3 mr-1 fill-white" />
              Featured
            </Badge>
          )}
        </div>

        {/* View count */}
        {example.viewCount && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 text-white/90 text-xs bg-black/30 px-2 py-1 rounded-full">
            <Eye className="h-3 w-3" />
            <span>{example.viewCount.toLocaleString()} views</span>
          </div>
        )}
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg line-clamp-1">{example.title}</CardTitle>
          <Badge variant="outline" className={complexityColors[example.complexity]}>
            {example.complexity}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {example.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* Story */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            "{example.story}"
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>{example.slideCount} slides</span>
          </div>
        </div>

        {/* Agents */}
        <div className="flex flex-wrap gap-1">
          {example.agents.map((agent) => (
            <Badge
              key={agent}
              variant="secondary"
              className={`text-xs ${agentColors[agent]}`}
            >
              {agentNames[agent]}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleViewExample}
          >
            <Eye className="h-4 w-4 mr-1" />
            View Full
          </Button>
          <Button
            size="sm"
            className="flex-1"
            asChild
          >
            <Link href={`/builder?example=${example.id}`}>
              Use as Template
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
