'use client';

import { Integration } from '@/types/integration';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Clock, Zap, FileText } from 'lucide-react';

interface IntegrationCardProps {
  integration: Integration;
}

const statusConfig = {
  'available': {
    label: 'Available Now',
    icon: Check,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  'coming-soon': {
    label: 'Coming Soon',
    icon: Clock,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  'beta': {
    label: 'Beta',
    icon: Zap,
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  },
};

const difficultyConfig = {
  'easy': { label: 'Easy Setup', color: 'text-green-600 dark:text-green-400' },
  'moderate': { label: 'Moderate Setup', color: 'text-yellow-600 dark:text-yellow-400' },
  'advanced': { label: 'Advanced Setup', color: 'text-red-600 dark:text-red-400' },
};

const categoryIcons = {
  'export': '📤',
  'storage': '☁️',
  'communication': '💬',
  'content': '🎨',
  'productivity': '⚡',
};

export function IntegrationCard({ integration }: IntegrationCardProps) {
  const StatusIcon = statusConfig[integration.status].icon;

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="pb-3">
        {/* Logo Placeholder */}
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 flex items-center justify-center mb-4">
          <span className="text-3xl">{categoryIcons[integration.category]}</span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{integration.name}</CardTitle>
          </div>
          <div className="flex flex-col gap-1">
            <Badge className={statusConfig[integration.status].className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[integration.status].label}
            </Badge>
            {integration.popular && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                Popular
              </Badge>
            )}
          </div>
        </div>

        <CardDescription className="line-clamp-2 text-sm mt-2">
          {integration.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Features */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Features
          </p>
          <ul className="space-y-1">
            {integration.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Setup Difficulty */}
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className={difficultyConfig[integration.setupDifficulty].color}>
            {difficultyConfig[integration.setupDifficulty].label}
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        {integration.status === 'available' ? (
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1">
              Learn More
            </Button>
            <Button size="sm" className="flex-1">
              Connect
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" disabled>
            {integration.status === 'beta' ? 'Request Beta Access' : 'Notify Me'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
