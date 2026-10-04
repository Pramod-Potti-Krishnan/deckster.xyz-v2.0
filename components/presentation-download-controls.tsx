"use client"

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, Check, Download, FileText, Loader2, Presentation, RefreshCw } from 'lucide-react';
import { downloadPDF, downloadPPTX, DownloadQuality } from '@/lib/api/download-service';
import { useToast } from '@/hooks/use-toast';
import './studio-delivery.css';

const STUDIO_DELIVERY = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';

function DownloadMenuPortal({ container, children }: { container: Element | null; children: React.ReactNode }) {
  // Fullscreen hides body portals outside its element. Classic keeps its native portal.
  return STUDIO_DELIVERY
    ? <DropdownMenuPortal container={container ?? undefined}>{children}</DropdownMenuPortal>
    : <>{children}</>;
}

type DownloadFeedback = {
  sourceUrl: string;
  sourceId: string | null;
  format: 'PDF' | 'PowerPoint';
  status: 'converting' | 'started' | 'failed';
  message: string;
};

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
  const [feedback, setFeedback] = useState<DownloadFeedback | null>(null);
  const [menuPortalContainer, setMenuPortalContainer] = useState<Element | null>(null);
  // A result belongs to the deck that requested it, even if the active deck changed.
  const currentFeedback = feedback?.sourceUrl === presentationUrl && feedback?.sourceId === presentationId ? feedback : null;

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
    if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PDF', status: 'converting', message: 'Preparing your PDF…' });

    try {
      const result = await downloadPDF(presentationUrl, quality);

      if (result.success) {
        if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PDF', status: 'started', message: 'Your browser download has started.' });
        toast({
          title: 'PDF Download Started',
          description: `Your PDF is being downloaded (${quality} quality)`,
        });
      } else {
        if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PDF', status: 'failed', message: result.error || 'Failed to download PDF' });
        toast({
          title: 'Download Failed',
          description: result.error || 'Failed to download PDF',
          variant: 'destructive',
        });
      }
    } catch (error) {
      if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PDF', status: 'failed', message: error instanceof Error ? error.message : 'Unknown error' });
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
    if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PowerPoint', status: 'converting', message: 'Preparing your PowerPoint file…' });

    try {
      // Use slideCount if available, otherwise default to 1 (backend will auto-detect)
      const effectiveSlideCount = slideCount && slideCount > 0 ? slideCount : 1;
      const result = await downloadPPTX(presentationUrl, effectiveSlideCount, quality);

      if (result.success) {
        if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PowerPoint', status: 'started', message: 'Your browser download has started.' });
        toast({
          title: 'PPTX Download Started',
          description: `Your PowerPoint is being downloaded (${quality} quality)`,
        });
      } else {
        if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PowerPoint', status: 'failed', message: result.error || 'Failed to download PPTX' });
        toast({
          title: 'Download Failed',
          description: result.error || 'Failed to download PPTX',
          variant: 'destructive',
        });
      }
    } catch (error) {
      if (STUDIO_DELIVERY) setFeedback({ sourceUrl: presentationUrl, sourceId: presentationId, format: 'PowerPoint', status: 'failed', message: error instanceof Error ? error.message : 'Unknown error' });
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
    <div className={`flex items-center ${className}`} data-studio-v4-shell={STUDIO_DELIVERY} data-studio-download-control={STUDIO_DELIVERY}>
      <DropdownMenu onOpenChange={STUDIO_DELIVERY ? (open) => {
        setMenuPortalContainer(open ? document.fullscreenElement : null);
      } : undefined}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={!isDownloadEnabled || isDownloading}
            aria-label={STUDIO_DELIVERY ? isDownloading ? 'Converting presentation for download' : isDownloadEnabled ? 'Download presentation' : 'Download unavailable until presentation is ready' : undefined}
            aria-busy={STUDIO_DELIVERY ? isDownloading : undefined}
            className="flex h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200"
            title={!isDownloadEnabled ? 'Waiting for presentation...' : 'Download as PDF or PPTX'}
          >
            {STUDIO_DELIVERY && isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className={`h-5 w-5 ${isDownloading ? 'animate-pulse' : ''}`} />}
            <span className="text-[10px] font-medium">{isDownloading ? 'Converting' : 'Download'}</span>
          </button>
        </DropdownMenuTrigger>
        <DownloadMenuPortal container={menuPortalContainer}>
        <DropdownMenuContent align="end" className="w-48" data-studio-v4-shell={STUDIO_DELIVERY} data-studio-download-menu={STUDIO_DELIVERY}>
          {STUDIO_DELIVERY && (
            <>
              <DropdownMenuLabel className="studio-download-heading">
                <span>Delivery</span><strong>Download your presentation</strong>
                <small>Deck stage: {getStageLabel()} · {quality} quality{slideCount && slideCount > 0 ? ` · ${slideCount} slides` : ''}</small>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={handleDownloadPDF}
            onSelect={STUDIO_DELIVERY ? (event) => event.preventDefault() : undefined}
            disabled={isDownloading}
            title={getTooltip('PDF')}
            className="cursor-pointer studio-download-format"
          >
            <FileText className="mr-2 h-4 w-4" />
            {STUDIO_DELIVERY ? <span><strong>PDF document</strong><small>Read and share your slides as a .pdf file.</small></span> : <span>Download as PDF</span>}
            {STUDIO_DELIVERY && <em>.pdf</em>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDownloadPPTX}
            onSelect={STUDIO_DELIVERY ? (event) => event.preventDefault() : undefined}
            disabled={isDownloading}
            title={getTooltip('PPTX')}
            className="cursor-pointer studio-download-format"
          >
            <Presentation className="mr-2 h-4 w-4" />
            {STUDIO_DELIVERY ? <span><strong>PowerPoint presentation</strong><small>Open your presentation in PowerPoint.</small></span> : <span>Download as PPTX</span>}
            {STUDIO_DELIVERY && <em>.pptx</em>}
          </DropdownMenuItem>
          {STUDIO_DELIVERY && (
            <>
              <DropdownMenuSeparator />
              {currentFeedback ? (
                <div className="studio-download-feedback" data-download-status={currentFeedback.status}
                  role={currentFeedback.status === 'failed' ? 'alert' : 'status'} aria-live="polite" aria-busy={isDownloading}>
                  {currentFeedback.status === 'converting' ? <Loader2 size={16} className="animate-spin" /> : currentFeedback.status === 'failed' ? <AlertCircle size={16} /> : <Check size={16} />}
                  <span><strong>{currentFeedback.status === 'failed' ? `${currentFeedback.format} download failed` : currentFeedback.status === 'converting' ? 'Converting presentation' : `${currentFeedback.format} download started`}</strong><small>{currentFeedback.message}</small></span>
                </div>
              ) : <p className="studio-download-note">Exports use the presentation currently open. Choose a format to start its conversion.</p>}
              {currentFeedback?.status === 'failed' && (
                <DropdownMenuItem className="studio-download-retry" disabled={isDownloading}
                  onSelect={(event) => event.preventDefault()}
                  onClick={currentFeedback.format === 'PDF' ? handleDownloadPDF : handleDownloadPPTX}>
                  <RefreshCw size={14} />Try {currentFeedback.format} again
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
        </DownloadMenuPortal>
      </DropdownMenu>
      {STUDIO_DELIVERY && <span className="sr-only" role="status" aria-live="polite">{currentFeedback ? `${currentFeedback.format}: ${currentFeedback.message}` : !isDownloadEnabled ? 'Download unlocks when a presentation is available at stage four.' : ''}</span>}
    </div>
  );
}
