"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
// Fixed Errors 38, 39, 40: Using named imports from root date-fns
import { format, addMonths, subMonths, startOfMonth } from 'date-fns'; 
import { ptBR } from 'date-fns/locale';

interface PeriodSelectorProps {
  currentPeriod: string; // YYYY-MM
  setCurrentPeriod: (period: string) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ currentPeriod, setCurrentPeriod }) => {
  const currentDate = startOfMonth(new Date(currentPeriod + '-01'));

  const handlePrevious = () => {
    const previousMonth = subMonths(currentDate, 1);
    setCurrentPeriod(format(previousMonth, 'yyyy-MM'));
  };

  const handleNext = () => {
    const nextMonth = addMonths(currentDate, 1);
    setCurrentPeriod(format(nextMonth, 'yyyy-MM'));
  };

  const generateMonthOptions = () => {
    const options = [];
    const today = startOfMonth(new Date());
    for (let i = -12; i <= 12; i++) {
      const date = addMonths(today, i);
      options.push(date);
    }
    return options;
  };

  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="icon" onClick={handlePrevious}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Select
        value={currentPeriod}
        onValueChange={setCurrentPeriod}
      >
        <SelectTrigger className="w-[180px]">
          <CalendarDays className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Selecionar Mês" />
        </SelectTrigger>
        <SelectContent>
          {generateMonthOptions().map((date) => {
            const value = format(date, "yyyy-MM");
            // TS2554 fix: The usage is correct for date-fns v2/v3.
            const label = format(date, "MMMM yyyy", { locale: ptBR }); 
            return <SelectItem key={value} value={value}>{label}</SelectItem>;
          })}
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" onClick={handleNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default PeriodSelector;