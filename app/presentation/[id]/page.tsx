"use client"

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PresentationViewer } from '@/components/presentation-viewer'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface PresentationPageProps {
  params: Promise<{ id: string }>
}

export default function PresentationPage({ params }: PresentationPageProps) {
  const router = useRouter()
  const { id } = use(params)
  const [presentationUrl, setPresentationUrl] = useState<string>('')
  const [slideCount, setSlideCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch presentation metadata from v7.5-main API
    async function fetchPresentation() {
      try {
        setIsLoading(true)
        setError(null)

        // Use the v7.5-main presentation viewer URL
        const viewerUrl = `https://web-production-f0d13.up.railway.app/viewer/${id}`

        setPresentationUrl(viewerUrl)

        // TODO: Fetch actual slide count from API if available
        // For now, we'll let the PresentationViewer component handle it
        setSlideCount(null)

        console.log('📺 Loading presentation:', id)
        console.log('🔗 Viewer URL:', viewerUrl)
      } catch (err) {
        console.error('Error loading presentation:', err)
        setError(err instanceof Error ? err.message : 'Failed to load presentation')
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchPresentation()
    }
  }, [id])

  const handleExit = () => {
    // Go back to builder or home
    router.push('/builder')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading presentation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Presentation</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={handleExit}>
            Return to Builder
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Bar with Exit Button */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExit}
          className="bg-white/90 hover:bg-white border-gray-300 shadow-lg"
        >
          <X className="h-4 w-4 mr-1" />
          Exit Fullscreen
        </Button>
      </div>

      {/* Full-Screen Presentation Viewer */}
      <div className="flex-1 flex flex-col">
        {presentationUrl ? (
          <PresentationViewer
            presentationUrl={presentationUrl}
            presentationId={id}
            slideCount={slideCount}
            showControls={true}
            className="flex-1"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white">No presentation URL available</p>
          </div>
        )}
      </div>
    </div>
  )
}
