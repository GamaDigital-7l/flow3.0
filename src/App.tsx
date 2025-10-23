import React, { useState, useEffect, useCallback, useTransition } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { SessionContextProvider, useSession } from "@/integrations/supabase/auth";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import Study from "./pages/Study";
import Health from "./pages/Health";
import Notes from "./pages/Notes";
import Results from "./pages/Results";
import Settings from "./pages/Settings";
import Finance from "./pages/Finance";
import Books from "./pages/Books";
import BookDetails from "./pages/BookDetails";
import BookReaderFullScreen from "./pages/BookReaderFullScreen";
import Tasks from "./pages/Tasks"; // Importando Tasks
import FinancialManagement from "./pages/FinancialManagement"; // Importando FinancialManagement
import Recurrence from "./pages/Recurrence"; // Importando Recurrence
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '@/integrations/query/client';
import DeepLinkHandler from "./components/DeepLinkHandler";
import { showError } from "@/utils/toast";

// Main App component wrapper for context providers
function App() {
  return (
    <SessionContextProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <Toaster position="top-right" richColors />
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </PersistQueryClientProvider>
    </SessionContextProvider>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Caught an error: ", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You could render any custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-red-500">Algo deu errado!</h2>
            <p className="text-lg text-muted-foreground">
              Ocorreu um erro inesperado no aplicativo. Por favor, tente novamente mais tarde.
            </p>
            {this.state.error && (
              <details style={{ whiteSpace: 'pre-wrap' }} className="mt-4">
                <summary className="text-sm text-muted-foreground cursor-pointer">Detalhes do erro</summary>
                <p className="text-xs text-red-400">{this.state.error.message}</p>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component handling routing and PWA state
function AppContent() {
  const { session, isLoading } = useSession();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Carregando sessão...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DeepLinkHandler />
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/approval/:uniqueId" element={<NotFound />} />
        <Route path="/books/:id/read" element={<BookReaderFullScreen />} />

        {/* Rotas Protegidas */}
        <Route element={<ProtectedRoute session={session} />}>
          <Route element={<Layout isOnline={isOnline} deferredPrompt={null} onInstallClick={() => {}} />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/recurrence" element={<Recurrence />} /> {/* NOVA ROTA */}
            <Route path="/finance" element={<Finance />} />
            <Route path="/financial-management" element={<FinancialManagement />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/study" element={<Study />} />
            <Route path="/health" element={<Health />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/results" element={<Results />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/books" element={<Books />} />
            <Route path="/books/:id" element={<BookDetails />} />
          </Route>
        </Route>
        
        {/* Rota 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;