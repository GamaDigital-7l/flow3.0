import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Providers from "@/components/Providers";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Gama Flow - Seu Gerenciador de Produtividade",
  description: "Otimize seu fluxo de trabalho e gerencie tarefas com eficiência.",
  // --- FAVICON UPDATE ---
  icons: {
    icon: '/favicon.ico', // Usando o favicon.ico fornecido
    shortcut: '/favicon.ico',
    apple: '/assets/images/foto de perfil gama .jpg', // Usando a foto de perfil para ícone Apple
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}