import React, { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TimePicker from "@/components/TimePicker";
import { TaskFormValues } from "@/components/TaskForm";
import { TaskRecurrenceType } from "@/types/task";

const DAYS_OF_WEEK = [
  { value: "Sunday", label: "Dom" },
  { value: "Monday", label: "Seg" },
  { value: "Tuesday", label: "Ter" },
  { value: "Wednesday", label: "Qua" },
  { value: "Thursday", label: "Qui" },
  { value: "Friday", label: "Sex" },
  { value: "Saturday", label: "Sáb" },
];

interface TaskSchedulingProps {
  form: UseFormReturn<TaskFormValues>;
}

const TaskScheduling: React.FC<TaskSchedulingProps> = ({ form }) => {
  const recurrenceType = form.watch("recurrence_type");
  const watchedRecurrenceDetails = form.watch("recurrence_details");

  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  useEffect(() => {
    if (recurrenceType === "weekly" && watchedRecurrenceDetails) {
      setSelectedDays(watchedRecurrenceDetails.split(',').filter(d => d !== ''));
    } else {
      setSelectedDays([]);
    }
  }, [recurrenceType, watchedRecurrenceDetails]);

  const handleDayToggle = (dayValue: string) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue];
      form.setValue("recurrence_details", newDays.join(','), { shouldDirty: true });
      return newDays;
    });
  };

  return (
    <>
      <FormField
        control={form.control}
        name="recurrence_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-foreground">Recorrência</FormLabel>
            <Select
              onValueChange={(value: TaskRecurrenceType) => {
                field.onChange(value);
                form.setValue("recurrence_details", null);
                form.setValue("recurrence_time", null);
                // Garantir que is_daily_recurring seja removido, se existir no form
                if ('is_daily_recurring' in form.getValues()) {
                    form.setValue("is_daily_recurring", false as any);
                }
                setSelectedDays([]);
              }}
              value={field.value}
            >
              <FormControl>
                <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                  <SelectValue placeholder="Selecionar tipo de recorrência" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Campo de Horário de Recorrência */}
      {recurrenceType !== "none" && (
        <FormField
          control={form.control}
          name="recurrence_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Horário de Recorrência (Opcional)</FormLabel>
              <FormControl>
                <TimePicker
                  value={field.value || null}
                  onChange={(time) => field.onChange(time || null)}
                />
              </FormControl>
              <FormDescription className="text-muted-foreground">
                Se definido, a tarefa será instanciada com este horário.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {recurrenceType === "weekly" && (
        <FormItem>
          <FormLabel className="text-foreground">Dias da Semana</FormLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.value}`}
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={() => handleDayToggle(day.value)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                />
                <Label htmlFor={`day-${day.value}`} className="text-foreground">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}

      {recurrenceType === "monthly" && (
        <FormField
          control={form.control}
          name="recurrence_details"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Dia do Mês</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 15"
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
};

export default TaskScheduling;