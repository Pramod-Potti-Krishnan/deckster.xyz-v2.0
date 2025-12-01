"use client"

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Presentation } from 'lucide-react';
import { downloadPDF, downloadPPTX, DownloadQuality } from '@/lib/api/download-service';
import { useToast } from '@/hooks/use-toast';

export interface PresentationDownloadControlsProps {
  presentationUrl: string | null;
  presentationId: string | null;
  slideCount: number | null;
  stage: number;
  className?: string;
}

/**
 * PresentationDownloadControls Component
 *
 * Displays floating download buttons for PDF and PPTX formats
 * positioned at the top-right of the presentation preview area.
 *
 * Features:
 * - Automatically enables when presentationUrl is available (Stage 4+)
 * - Downloads using v7.5 Downloads Service
 * - Shows loading state during 5-15 second conversion
 * - Displays toast notifications for success/error
 * - Quality options: high (default), medium, low
 */
export function PresentationDownloadControls({
  presentationUrl,
  presentationId,
  slideCount,
  stage,
  className = ''
}: PresentationDownloadControlsProps) {
  const { toast } = useToast();
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingPPTX, setIsDownloadingPPTX] = useState(false);
  const [quality] = useState<DownloadQuality>('high');

  // Check if downloads should be enabled
  // Enable from Stage 4 onwards when presentationUrl is available
  const isDownloadEnabled = presentationUrl !== null && stage >= 4;

  // Get stage label for user feedback
  const getStageLabel = (): string => {
    if (stage === 4) return 'strawman';
    if (stage === 5) return 'refined';
    return 'final';
  };

  const handleDownloadPDF = async () => {
    if (!presentationUrl) {
      toast({
        title: 'Download Not Available',
        description: 'Presentation URL is not available yet',
        variant: 'destructive',
      });
      return;
    }

    setIsDownloadingPDF(true);

    try {
      const result = await downloadPDF(presentationUrl, quality);

      if (result.success) {
        toast({
          title: 'PDF Download Started',
          description: `Your PDF is being downloaded (${quality} quality)`,
        });
      } else {
        toast({
          title: 'Download Failed',
          description: result.error || 'Failed to download PDF',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Download Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDownloadPPTX = async () => {
    if (!presentationUrl) {
      toast({
        title: 'Download Not Available',
        description: 'Presentation URL is not available yet',
        variant: 'destructive',
      });
      return;
    }

    setIsDownloadingPPTX(true);

    try {
      // Use slideCount if available, otherwise default to 1 (backend will auto-detect)
      const effectiveSlideCount = slideCount && slideCount > 0 ? slideCount : 1;
      const result = await downloadPPTX(presentationUrl, effectiveSlideCount, quality);

      if (result.success) {
        toast({
          title: 'PPTX Download Started',
          description: `Your PowerPoint is being downloaded (${quality} quality)`,
        });
      } else {
        toast({
          title: 'Download Failed',
          description: result.error || 'Failed to download PPTX',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Download Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingPPTX(false);
    }
  };

  // Get button tooltip
  const getTooltip = (format: string): string => {
    if (!isDownloadEnabled) {
      return 'Presentation not ready yet. Waiting for Stage 4 (strawman)...';
    }
    const stageLabel = getStageLabel();
    return `Download ${format} (${stageLabel} version, ${quality} quality)`;
  };

  const isDownloading = isDownloadingPDF || isDownloadingPPTX;

  return (
    <div className={`flex items-center ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={!isDownloadEnabled || isDownloading}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!isDownloadEnabled ? 'Waiting for presentation...' : 'Download as PDF or PPTX'}
          >
            <Download className={`h-5 w-5 text-gray-700 ${isDownloading ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] text-gray-500">{isDownloading ? 'Converting' : 'Download'}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>Download as PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDownloadPPTX}
            disabled={isDownloading}
            className="cursor-pointer"
          >
            <Presentation className="mr-2 h-4 w-4" />
            <span>Download as PPTX</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
