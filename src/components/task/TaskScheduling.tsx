"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import TimePicker from "@/components/TimePicker";
import { cn } from "@/lib/utils";
import { TaskFormValues } from "@/components/TaskForm";
import { Button } from "@/components/ui/button"; // Adicionando import do Button

interface TaskSchedulingProps {
  form: UseFormReturn<TaskFormValues>;
}

const TaskScheduling: React.FC<TaskSchedulingProps> = ({ form }) => {
  const isDailyRecurring = form.watch("is_daily_recurring");

  return (
    <div className="space-y-4">
      {/* Data de Vencimento */}
      <FormField
        control={form.control}
        name="due_date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Data de Vencimento (Opcional)</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                      !field.value && "text-muted-foreground"
                    )}
                    disabled={isDailyRecurring}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {field.value ? (
                      format(field.value, "PPP", { locale: ptBR })
                    ) : (
                      <span>Escolha uma data</span>
                    )}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
                <Calendar
                  mode="single"
                  selected={field.value || undefined}
                  onSelect={field.onChange}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Horário */}
      <FormField
        control={form.control}
        name="time"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Horário (Opcional)</FormLabel>
            <FormControl>
              <TimePicker
                value={field.value || null}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default TaskScheduling;