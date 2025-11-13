/**
 * v7.5 Downloads Service API Client
 *
 * Handles communication with the v7.5 Downloads Service for converting
 * presentations to PDF and PPTX formats.
 *
 * Service URL: https://web-production-4908a.up.railway.app
 */

const DOWNLOAD_SERVICE_URL = process.env.NEXT_PUBLIC_DOWNLOAD_SERVICE_URL || 'https://web-production-4908a.up.railway.app';

export type DownloadQuality = 'high' | 'medium' | 'low';
export type DownloadFormat = 'pdf' | 'pptx';

export interface DownloadResult {
  success: boolean;
  error?: string;
}

export interface PDFConversionRequest {
  presentation_url: string;
  landscape?: boolean;
  print_background?: boolean;
  quality?: DownloadQuality;
}

export interface PPTXConversionRequest {
  presentation_url: string;
  slide_count: number;
  aspect_ratio?: '16:9' | '4:3';
  quality?: DownloadQuality;
}

/**
 * Download a presentation as PDF
 *
 * Endpoint: POST /convert/pdf
 *
 * @param presentationUrl - Full URL to the presentation (e.g., https://v75-main.railway.app/p/abc123)
 * @param quality - Quality level: 'high' (default), 'medium', or 'low'
 * @returns Promise with download result
 */
export async function downloadPDF(
  presentationUrl: string,
  quality: DownloadQuality = 'high'
): Promise<DownloadResult> {
  if (!presentationUrl) {
    return {
      success: false,
      error: 'Presentation URL is required'
    };
  }

  try {
    const request: PDFConversionRequest = {
      presentation_url: presentationUrl,
      landscape: true,
      print_background: true,
      quality
    };

    const response = await fetch(`${DOWNLOAD_SERVICE_URL}/convert/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return await handleErrorResponse(response, 'PDF');
    }

    // Get the blob
    const blob = await response.blob();

    // Generate filename
    const filename = generateFilename(presentationUrl, 'pdf');

    // Trigger download
    triggerDownload(blob, filename);

    return { success: true };
  } catch (error) {
    console.error('PDF download error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Download a presentation as PPTX
 *
 * Endpoint: POST /convert/pptx
 *
 * @param presentationUrl - Full URL to the presentation
 * @param slideCount - Number of slides in the presentation (required)
 * @param quality - Quality level: 'high' (default), 'medium', or 'low'
 * @returns Promise with download result
 */
export async function downloadPPTX(
  presentationUrl: string,
  slideCount: number,
  quality: DownloadQuality = 'high'
): Promise<DownloadResult> {
  if (!presentationUrl) {
    return {
      success: false,
      error: 'Presentation URL is required'
    };
  }

  if (!slideCount || slideCount <= 0) {
    return {
      success: false,
      error: 'Valid slide count is required'
    };
  }

  try {
    const request: PPTXConversionRequest = {
      presentation_url: presentationUrl,
      slide_count: slideCount,
      aspect_ratio: '16:9',
      quality
    };

    const response = await fetch(`${DOWNLOAD_SERVICE_URL}/convert/pptx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return await handleErrorResponse(response, 'PPTX');
    }

    // Get the blob
    const blob = await response.blob();

    // Generate filename
    const filename = generateFilename(presentationUrl, 'pptx');

    // Trigger download
    triggerDownload(blob, filename);

    return { success: true };
  } catch (error) {
    console.error('PPTX download error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Handle error responses from the download service
 */
async function handleErrorResponse(response: Response, format: string): Promise<DownloadResult> {
  let errorMessage = `${format} conversion failed`;

  try {
    const errorData = await response.json();
    errorMessage = errorData.detail || errorMessage;
  } catch {
    // If JSON parsing fails, use status text
    errorMessage = response.statusText || errorMessage;
  }

  // Handle specific error codes
  switch (response.status) {
    case 422:
      errorMessage = `Invalid request: ${errorMessage}`;
      break;
    case 500:
      errorMessage = `Conversion failed: ${errorMessage}`;
      break;
    case 503:
      errorMessage = 'Service temporarily unavailable. Please try again.';
      break;
    default:
      errorMessage = `Download failed: ${errorMessage}`;
  }

  console.error(`${format} download failed:`, response.status, errorMessage);

  return {
    success: false,
    error: errorMessage
  };
}

/**
 * Generate a filename from the presentation URL
 */
function generateFilename(presentationUrl: string, format: 'pdf' | 'pptx'): string {
  try {
    // Extract presentation ID from URL
    const url = new URL(presentationUrl);
    const pathParts = url.pathname.split('/');
    const presentationId = pathParts[pathParts.length - 1] || 'presentation';

    // Add timestamp
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    return `${presentationId}_${timestamp}.${format}`;
  } catch {
    // Fallback filename if URL parsing fails
    const timestamp = new Date().toISOString().slice(0, 10);
    return `presentation_${timestamp}.${format}`;
  }
}

/**
 * Trigger browser download of a blob
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the blob URL
  window.URL.revokeObjectURL(url);
}

/**
 * Check if the Download Service is available
 */
export async function checkDownloadServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${DOWNLOAD_SERVICE_URL}/health`, {
      method: 'GET'
    });
    return response.ok;
  } catch (error) {
    console.error('Download Service health check failed:', error);
    return false;
  }
}

/**
 * Get service information
 */
export async function getServiceInfo(): Promise<any> {
  try {
    const response = await fetch(`${DOWNLOAD_SERVICE_URL}/`, {
      method: 'GET'
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to get service info:', error);
    return null;
  }
}
