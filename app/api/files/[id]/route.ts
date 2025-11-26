import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { id: fileId } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get file and validate ownership
    const file = await prisma.uploadedFile.findUnique({
      where: { id: fileId }
    })

    if (!file || file.userId !== user.id) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Delete from database (CASCADE will handle cleanup)
    await prisma.uploadedFile.delete({
      where: { id: fileId }
    })

    // Optionally: Call backend to delete from Gemini File API
    // (Files auto-delete after 48 hours, so this is optional)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
