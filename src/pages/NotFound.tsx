"use client";

import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // console.error( // Removido console.error de depuração
    //   "404 Error: User attempted to access non-existent route:",
    //   location.pathname,
    // );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 md:p-6 lg:p-8"> {/* Ajustado padding */}
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">404</h1> {/* Fontes adaptáveis */}
        <p className="text-xl md:text-2xl text-muted-foreground mb-4">Oops! Página não encontrada</p> {/* Fontes adaptáveis */}
        <a href="/" className="text-primary hover:text-primary-light underline text-base md:text-lg"> {/* Fontes adaptáveis */}
          Voltar para a Página Inicial
        </a>
      </div>
    </div>
  );
};

export default NotFound;