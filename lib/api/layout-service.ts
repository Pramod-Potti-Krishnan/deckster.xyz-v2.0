/**
 * Layout Service API Client
 *
 * Handles communication with the Layout Service REST API for downloading
 * presentations in PDF and PPTX formats.
 *
 * Base URL: https://web-production-f0d13.up.railway.app
 */

const LAYOUT_SERVICE_URL = process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL;

if (!LAYOUT_SERVICE_URL) {
  console.warn('NEXT_PUBLIC_LAYOUT_SERVICE_URL is not configured');
}

export type PresentationVersion = 'strawman' | 'refined' | 'final';
export type DownloadFormat = 'pdf' | 'pptx';

export interface DownloadOptions {
  presentationId: string;
  version: PresentationVersion;
  format: DownloadFormat;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

/**
 * Download a presentation as PDF
 *
 * Endpoint: GET /api/presentations/{presentation_id}/download/pdf?version={version}
 *
 * @param presentationId - The presentation ID from Director
 * @param version - Version to download (strawman, refined, or final)
 * @returns Promise with download result
 */
export async function downloadPDF(
  presentationId: string,
  version: PresentationVersion = 'final'
): Promise<DownloadResult> {
  return downloadPresentation({
    presentationId,
    version,
    format: 'pdf'
  });
}

/**
 * Download a presentation as PPTX
 *
 * Endpoint: GET /api/presentations/{presentation_id}/download/pptx?version={version}
 *
 * @param presentationId - The presentation ID from Director
 * @param version - Version to download (strawman, refined, or final)
 * @returns Promise with download result
 */
export async function downloadPPTX(
  presentationId: string,
  version: PresentationVersion = 'final'
): Promise<DownloadResult> {
  return downloadPresentation({
    presentationId,
    version,
    format: 'pptx'
  });
}

/**
 * Internal function to handle the actual download logic
 */
async function downloadPresentation(
  options: DownloadOptions
): Promise<DownloadResult> {
  const { presentationId, version, format } = options;

  if (!LAYOUT_SERVICE_URL) {
    return {
      success: false,
      error: 'Layout Service URL is not configured'
    };
  }

  try {
    // Construct the download URL
    const url = `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/download/${format}?version=${version}`;

    // Fetch the file
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Download failed:', response.status, errorText);

      return {
        success: false,
        error: `Failed to download presentation: ${response.statusText}`
      };
    }

    // Get the blob
    const blob = await response.blob();

    // Generate filename with version and timestamp
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `presentation_${version}_${timestamp}.${format}`;

    // Create a download link and trigger download
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the blob URL
    window.URL.revokeObjectURL(downloadUrl);

    return { success: true };
  } catch (error) {
    console.error('Download error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Check if the Layout Service is available
 */
export async function checkLayoutServiceHealth(): Promise<boolean> {
  if (!LAYOUT_SERVICE_URL) {
    return false;
  }

  try {
    const response = await fetch(`${LAYOUT_SERVICE_URL}/health`, {
      method: 'GET'
    });
    return response.ok;
  } catch (error) {
    console.error('Layout Service health check failed:', error);
    return false;
  }
}
