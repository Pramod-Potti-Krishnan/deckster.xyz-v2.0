"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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

    if (!slideCount || slideCount <= 0) {
      toast({
        title: 'Download Not Available',
        description: 'Slide count is not available yet',
        variant: 'destructive',
      });
      return;
    }

    setIsDownloadingPPTX(true);

    try {
      const result = await downloadPPTX(presentationUrl, slideCount, quality);

      if (result.success) {
        toast({
          title: 'PPTX Download Started',
          description: `Your PowerPoint is being downloaded (${quality} quality, ${slideCount} slides)`,
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

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        onClick={handleDownloadPDF}
        disabled={!isDownloadEnabled || isDownloadingPDF}
        size="sm"
        variant="outline"
        className="shadow-md"
        title={getTooltip('PDF')}
      >
        {isDownloadingPDF ? (
          <>
            <Download className="mr-2 h-4 w-4 animate-spin" />
            Converting...
          </>
        ) : (
          <>
            <FileText className="mr-2 h-4 w-4" />
            Download PDF
          </>
        )}
      </Button>

      <Button
        onClick={handleDownloadPPTX}
        disabled={!isDownloadEnabled || isDownloadingPPTX || !slideCount}
        size="sm"
        variant="outline"
        className="shadow-md"
        title={getTooltip('PPTX')}
      >
        {isDownloadingPPTX ? (
          <>
            <Download className="mr-2 h-4 w-4 animate-spin" />
            Converting...
          </>
        ) : (
          <>
            <Presentation className="mr-2 h-4 w-4" />
            Download PPTX
          </>
        )}
      </Button>

      {/* Status indicator */}
      {isDownloadEnabled && (
        <span className="text-xs text-muted-foreground ml-2">
          ({getStageLabel()}, {slideCount || '?'} slides)
        </span>
      )}

      {/* Loading hint */}
      {(isDownloadingPDF || isDownloadingPPTX) && (
        <span className="text-xs text-muted-foreground">
          (conversion takes 5-15 seconds)
        </span>
      )}
    </div>
  );
}
