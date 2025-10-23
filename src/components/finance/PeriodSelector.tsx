"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PeriodSelectorProps {
  currentPeriod: Date;
  onPeriodChange: (newPeriod: Date) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ currentPeriod, onPeriodChange }) => {
  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -12; i <= 12; i++) { // 12 meses para trás e 12 meses para frente
      const date = startOfMonth(addMonths(today, i));
      options.push(date);
    }
    return options;
  };

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    onPeriodChange(new Date(year, month - 1, 1));
  };

  const handleShortcut = (months: number) => {
    const newDate = addMonths(new Date(), -months);
    onPeriodChange(startOfMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1)));
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-card border border-border rounded-xl shadow-sm">
      {/* Controles de Mês */}
      <div className="flex items-center gap-2 w-full">
        <Button variant="ghost" size="icon" onClick={() => onPeriodChange(subMonths(currentPeriod, 1))} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select
          value={format(currentPeriod, "yyyy-MM")}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm">
            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <SelectValue placeholder="Selecionar Mês" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            {generateMonthOptions().map((date) => {
              const value = format(date, "yyyy-MM");
              const label = format(date, "MMMM yyyy", { locale: ptBR });
              return <SelectItem key={value} value={value}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => onPeriodChange(addMonths(currentPeriod, 1))} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Atalhos de Período */}
      <div className="grid grid-cols-4 gap-2 w-full border-t border-border pt-2">
        <Button variant="outline" size="sm" onClick={() => onPeriodChange(new Date())} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">Hoje</Button>
        <Button variant="outline" size="sm" onClick={() => handleShortcut(3)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">3m</Button>
        <Button variant="outline" size="sm" onClick={() => handleShortcut(6)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">6m</Button>
        <Button variant="outline" size="sm" onClick={() => handleShortcut(12)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">12m</Button>
      </div>
    </div>
  );
};

export default PeriodSelector;