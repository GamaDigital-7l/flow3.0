"use client";

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  session: Session | null;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ session }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;