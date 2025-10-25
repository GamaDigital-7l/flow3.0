import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pdfjs } from "react-pdf";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes"; // Importar ThemeProvider do next-themes
import { SessionContextProvider } from "@/integrations/supabase/auth";
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '@/integrations/query/client';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" attribute="class" storageKey="vite-ui-theme">
    <QueryClientProvider client={queryClient}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persist: true, persister }}>
        <SessionContextProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </SessionContextProvider>
      </PersistQueryClientProvider>
    </QueryClientProvider>
  </ThemeProvider>
);