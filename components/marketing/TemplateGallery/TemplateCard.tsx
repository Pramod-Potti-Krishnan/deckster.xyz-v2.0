'use client';

import { Template } from '@/types/template';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';

interface TemplateCardProps {
  template: Template;
  onUseTemplate?: (template: Template) => void;
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

export function TemplateCard({ template, onUseTemplate }: TemplateCardProps) {
  const handleUseTemplate = () => {
    if (onUseTemplate) {
      onUseTemplate(template);
    } else {
      // Default: navigate to builder with template
      window.location.href = `/builder?template=${template.id}`;
    }
  };

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600">
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <div className="text-center text-white/90">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <p className="text-sm font-medium">{template.category}</p>
          </div>
        </div>

        {/* Badges overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {template.new && (
            <Badge className="bg-blue-500 text-white shadow-md">
              <Sparkles className="h-3 w-3 mr-1" />
              New
            </Badge>
          )}
          {template.popular && (
            <Badge className="bg-orange-500 text-white shadow-md">
              <TrendingUp className="h-3 w-3 mr-1" />
              Popular
            </Badge>
          )}
          {template.featured && (
            <Badge className="bg-purple-500 text-white shadow-md">
              Featured
            </Badge>
          )}
        </div>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-1">{template.title}</CardTitle>
          <Badge variant="outline" className={complexityColors[template.complexity]}>
            {template.complexity}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {template.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>{template.slideCount} slides</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{template.complexity === 'basic' ? '5 min' : template.complexity === 'intermediate' ? '10 min' : '15 min'}</span>
          </div>
        </div>

        {/* Agents */}
        <div className="flex flex-wrap gap-1">
          {template.agents.map((agent) => (
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
            asChild
          >
            <Link href={`/templates/${template.id}`}>
              Preview
            </Link>
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleUseTemplate}
          >
            Use Template
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
