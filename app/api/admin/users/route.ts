import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { studioP2AdminOn, studioP2AdminPageWindow, studioP2AdminUsersQuery, studioP2AdminUsersWhere } from '@/lib/studio-p2-admin';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin (must match DEV_BYPASS_EMAIL)
    const isAdmin = !!session.user.email && session.user.email === process.env.DEV_BYPASS_EMAIL;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // PASS2 ADMIN hardening (NEXT_PUBLIC_STUDIO_P2_ADMIN, default off): one page at a time, with the approval filter and the search done here and the three figures over everyone.
    // Off, the code below this block runs exactly as it always did.
    if (studioP2AdminOn(process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN)) {
      const query = studioP2AdminUsersQuery((name) => request.nextUrl.searchParams.get(name));
      const where = studioP2AdminUsersWhere(query.filter, query.q);
      const [matching, everyone, approved] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.count(),
        prisma.user.count({ where: { approved: true } }),
      ]);
      const window = studioP2AdminPageWindow(matching, query.page, query.limit);
      const pageOfUsers = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          approved: true,
          approvedAt: true,
          approvedBy: true,
          createdAt: true,
          tier: true,
        },
        orderBy: [
          { approved: 'asc' }, // Pending first
          { createdAt: 'desc' }, // Newest first
          { id: 'asc' }, // a fixed order inside a tie, so no row is on two pages
        ],
        skip: window.skip,
        take: window.take,
      });
      return NextResponse.json({
        users: pageOfUsers,
        page: window.page,
        limit: window.take,
        total: matching,
        pageCount: window.pageCount,
        counts: { total: everyone, pending: everyone - approved, approved },
      });
    }

    // Fetch all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        approved: true,
        approvedAt: true,
        approvedBy: true,
        createdAt: true,
        tier: true,
      },
      orderBy: [
        { approved: 'asc' }, // Pending first
        { createdAt: 'desc' }, // Newest first
      ],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
