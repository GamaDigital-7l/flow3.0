"use client";

import React from 'react';

const AppLogo: React.FC = () => {
  const altText = "Gama Flow Logo";

  return (
    <div className="flex items-center h-10">
      {/* Logo para Modo Claro (Padrão) */}
      <img
        src="/assets/images/Gama-01.png"
        alt={altText + " - Light"}
        // h-8 é um bom tamanho para cabeçalho. Usando dark:hidden para esconder no modo escuro.
        className="h-8 w-auto object-contain dark:hidden" 
      />
      
      {/* Logo para Modo Escuro */}
      <img
        src="/assets/images/Gama Logo - Branca.png"
        alt={altText + " - Dark"}
        // hidden dark:block para mostrar apenas no modo escuro.
        className="h-8 w-auto object-contain hidden dark:block"
      />
    </div>
  );
};

export default AppLogo;