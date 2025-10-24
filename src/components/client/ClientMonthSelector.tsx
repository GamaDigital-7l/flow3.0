"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import format from 'date-fns/format';
import addMonths from 'date-fns/addMonths';
import subMonths from 'date-fns/subMonths';
import startOfMonth from 'date-fns/startOfMonth';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ClientMonthSelectorProps {
  currentMonthYear: string; // Formato YYYY-MM
  onMonthChange: (newMonthYear: string) => void;
}

const ClientMonthSelector: React.FC<ClientMonthSelectorProps> = ({ currentMonthYear, onMonthChange }) => {
  
  const currentPeriod = startOfMonth(new Date(currentMonthYear + '-01'));

  const generateMonthOptions = () => {
    const options = [];
    const today = startOfMonth(new Date());
    for (let i = -6; i <= 6; i++) { // 6 meses para trás e 6 meses para frente
      const date = addMonths(today, i);
      options.push(date);
    }
    return options;
  };

  const handleMonthChange = (value: string) => {
    onMonthChange(value);
  };

  const handleNavigateMonth = (offset: number) => {
    const newDate = offset > 0 ? addMonths(currentPeriod, offset) : subMonths(currentPeriod, Math.abs(offset));
    onMonthChange(format(newDate, "yyyy-MM"));
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-card border border-border rounded-xl shadow-sm">
      <div className="flex items-center gap-2 w-full">
        <Button variant="ghost" size="icon" onClick={() => handleNavigateMonth(-1)} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select
          value={currentMonthYear}
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
        <Button variant="ghost" size="icon" onClick={() => handleNavigateMonth(1)} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ClientMonthSelector;