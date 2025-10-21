"use client";

import { SessionContextProvider, useSession } from "@/integrations/supabase/auth";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function AppContent() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    // Você pode adicionar um componente de loading em tela cheia aqui
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <main>
      {!session ? <AuthPage /> : <DashboardPage />}
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SessionContextProvider>
          <AppContent />
        </SessionContextProvider>
        <Toaster richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;