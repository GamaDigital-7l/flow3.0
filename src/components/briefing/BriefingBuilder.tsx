"use client";

import React from 'react';
import Question from './Question';
import { Button } from '@/components/ui/button';

const BriefingBuilder = () => {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-4">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Construtor de Briefing
      </h2>
      <p className="text-muted-foreground">Adicione perguntas ao seu briefing.</p>
      <Question questionText="Your first question here?" />
      <Button>Adicionar Pergunta</Button>
    </div>
  );
};

export default BriefingBuilder;