"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Presentation } from 'lucide-react';
import { downloadPDF, downloadPPTX, PresentationVersion } from '@/lib/api/layout-service';
import { useToast } from '@/hooks/use-toast';

export interface PresentationDownloadControlsProps {
  presentationId: string | null;
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
 * - Automatically determines version based on current stage
 * - Stage 4 (strawman ready) → "strawman" version
 * - Stage 5 (reviewed/refined) → "refined" version
 * - Stage 6 (final content) → "final" version
 * - Disabled when no presentationId is available
 * - Shows loading state during download
 */
export function PresentationDownloadControls({
  presentationId,
  stage,
  className = ''
}: PresentationDownloadControlsProps) {
  const { toast } = useToast();
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingPPTX, setIsDownloadingPPTX] = useState(false);

  // Determine version based on current stage
  const getVersion = (): PresentationVersion => {
    if (stage === 4) return 'strawman';
    if (stage === 5) return 'refined';
    return 'final'; // stage 6 or later
  };

  // Check if downloads should be enabled
  // Enable from Stage 4 onwards when presentationId is available
  const isDownloadEnabled = presentationId !== null && stage >= 4;

  const handleDownloadPDF = async () => {
    if (!presentationId) return;

    setIsDownloadingPDF(true);

    try {
      const version = getVersion();
      const result = await downloadPDF(presentationId, version);

      if (result.success) {
        toast({
          title: 'Download Started',
          description: `PDF (${version}) is being downloaded`,
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
    if (!presentationId) return;

    setIsDownloadingPPTX(true);

    try {
      const version = getVersion();
      const result = await downloadPPTX(presentationId, version);

      if (result.success) {
        toast({
          title: 'Download Started',
          description: `PPTX (${version}) is being downloaded`,
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

  // Get version label for button tooltips
  const versionLabel = getVersion();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        onClick={handleDownloadPDF}
        disabled={!isDownloadEnabled || isDownloadingPDF}
        size="sm"
        variant="outline"
        className="shadow-md"
        title={isDownloadEnabled ? `Download PDF (${versionLabel})` : 'Presentation not ready yet'}
      >
        {isDownloadingPDF ? (
          <>
            <Download className="mr-2 h-4 w-4 animate-spin" />
            Downloading...
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
        disabled={!isDownloadEnabled || isDownloadingPPTX}
        size="sm"
        variant="outline"
        className="shadow-md"
        title={isDownloadEnabled ? `Download PPTX (${versionLabel})` : 'Presentation not ready yet'}
      >
        {isDownloadingPPTX ? (
          <>
            <Download className="mr-2 h-4 w-4 animate-spin" />
            Downloading...
          </>
        ) : (
          <>
            <Presentation className="mr-2 h-4 w-4" />
            Download PPTX
          </>
        )}
      </Button>

      {/* Version indicator */}
      {isDownloadEnabled && (
        <span className="text-xs text-muted-foreground ml-2">
          ({versionLabel})
        </span>
      )}
    </div>
  );
}
