"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

const quotes = [
  "O segredo de progredir é começar.",
  "A disciplina é a ponte entre metas e realizações.",
  "Não espere por oportunidades, crie-as.",
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "A constância é mais importante que a intensidade."
];

const MotivationalQuoteCard: React.FC = () => {
  const [quote, setQuote] = React.useState("");

  React.useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  return (
    <Card className="bg-card border-border shadow-sm card-hover-effect">
      <CardContent className="p-6 flex items-center gap-4">
        <Lightbulb className="h-8 w-8 text-yellow-400 flex-shrink-0" />
        <div>
          <p className="text-lg font-medium text-foreground">"{quote}"</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MotivationalQuoteCard;