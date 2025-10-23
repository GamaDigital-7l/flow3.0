import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pdfjs } from "react-pdf";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes"; // Importar ThemeProvider do next-themes

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </ThemeProvider>
);