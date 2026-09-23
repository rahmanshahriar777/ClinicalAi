'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { homeFor, useAuth } from '@/lib/auth';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.replace(user ? homeFor(user.role) : '/login');
  }, [user, loading, router]);
  return null;
}
