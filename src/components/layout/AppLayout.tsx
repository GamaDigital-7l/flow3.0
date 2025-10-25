"use client";

import React from 'react';
import { useSession } from '@/integrations/supabase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import DashboardWrapper from './DashboardWrapper';
import PageWrapper from './PageWrapper';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Componente de layout que gerencia a autenticação e aplica o layout correto.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = pathname === '/login' || pathname === '/signup';

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  // 2. Redirecionamento para Login
  if (!session && !isPublicRoute) {
    router.push('/login');
    return null;
  }

  // 3. Redirecionamento do Login para Dashboard
  if (session && isPublicRoute) {
    router.push('/');
    return null;
  }

  // 4. Renderização do Layout Autenticado
  if (session) {
    return (
      <DashboardWrapper>
        {children}
      </DashboardWrapper>
    );
  }

  // 5. Renderização do Layout Público (Login/Signup)
  return (
    <PageWrapper className="flex items-center justify-center min-h-screen">
      {children}
    </PageWrapper>
  );
};

export default AppLayout;