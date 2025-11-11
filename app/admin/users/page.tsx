'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, Check, X, Search, RefreshCw, Shield, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  tier: string;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');

  // Admin status is determined server-side; we'll rely on API response
  // Client-side check is not secure anyway - just show UI and let API enforce
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/admin/users');
    } else if (isAdmin === false) {
      // Only redirect if we've confirmed they're NOT an admin
      router.push('/builder');
    }
  }, [status, isAdmin, router]);

  // Fetch users
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setIsAdmin(true); // If API succeeds, user is admin
      } else if (response.status === 403) {
        setIsAdmin(false); // Forbidden - not an admin
      } else {
        console.error('Failed to fetch users');
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && isAdmin === null) {
      // Try to fetch users to determine admin status
      fetchUsers();
    }
  }, [status, isAdmin]);

  // Filter users
  useEffect(() => {
    let filtered = users;

    // Apply approval filter
    if (filter === 'pending') {
      filtered = filtered.filter(u => !u.approved);
    } else if (filter === 'approved') {
      filtered = filtered.filter(u => u.approved);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        u => u.email.toLowerCase().includes(query) ||
             u.name?.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  }, [users, filter, searchQuery]);

  // Approve user
  const handleApprove = async (userId: string) => {
    setIsApproving(userId);
    try {
      const response = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved: true })
      });

      if (response.ok) {
        await fetchUsers(); // Refresh list
      } else {
        console.error('Failed to approve user');
      }
    } catch (error) {
      console.error('Error approving user:', error);
    } finally {
      setIsApproving(null);
    }
  };

  // Reject/revoke approval
  const handleReject = async (userId: string) => {
    setIsApproving(userId);
    try {
      const response = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved: false })
      });

      if (response.ok) {
        await fetchUsers(); // Refresh list
      } else {
        console.error('Failed to reject user');
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
    } finally {
      setIsApproving(null);
    }
  };

  if (status === 'loading' || isLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/builder')} className="w-full">
              Go to Builder
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = users.filter(u => !u.approved).length;
  const approvedCount = users.filter(u => u.approved).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 transition-transform group-hover:scale-105">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                deckster
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-2">
                <Shield className="h-3 w-3" />
                Admin Panel
              </Badge>
              <Button variant="outline" size="sm" onClick={() => router.push('/builder')}>
                Go to Builder
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-muted-foreground">
              Approve or reject user access to deckster
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
                <p className="text-sm text-muted-foreground">Approved</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    All ({users.length})
                  </Button>
                  <Button
                    variant={filter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('pending')}
                  >
                    Pending ({pendingCount})
                  </Button>
                  <Button
                    variant={filter === 'approved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('approved')}
                  >
                    Approved ({approvedCount})
                  </Button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={fetchUsers}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* Users Table */}
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name || 'User'}
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-medium">
                            {(user.name || user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{user.name || 'Unknown'}</p>
                            {user.approved ? (
                              <Badge variant="default" className="bg-green-600">
                                <Check className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Pending
                              </Badge>
                            )}
                            <Badge variant="outline">{user.tier}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Signed up {format(new Date(user.createdAt), 'MMM d, yyyy')}
                            {user.approvedAt && ` • Approved ${format(new Date(user.approvedAt), 'MMM d, yyyy')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!user.approved ? (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(user.id)}
                            disabled={isApproving === user.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isApproving === user.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(user.id)}
                            disabled={isApproving === user.id}
                          >
                            {isApproving === user.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Revoke
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
