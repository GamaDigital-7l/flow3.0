"use client";

import React from 'react';

const NewEditReasonDialog: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 h-screen w-screen bg-black/50 flex items-center justify-center">
      <div className="bg-white p-4 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Solicitar Edição</h2>
        {/* Adicione aqui o formulário para inserir o motivo da edição */}
      </div>
    </div>
  );
};

export default NewEditReasonDialog;