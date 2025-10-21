import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TimePicker from "@/components/TimePicker";
import { TaskFormValues } from "@/components/TaskForm";
import { TaskRecurrenceType } from "@/types/task";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

const TaskScheduling: React.FC<TaskSchedulingProps> = ({ form }) => {
  const recurrenceType = form.watch("recurrence_type");
  const isDailyRecurring = form.watch("is_daily_recurring");

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
                form.setValue("is_daily_recurring", value === "daily" ? form.getValues("is_daily_recurring") : false);
              }}
              value={field.value}
              disabled={isDailyRecurring}
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

      {recurrenceType === "daily" && (
        <FormField
          control={form.control}
          name="is_daily_recurring"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      form.setValue('recurrence_type', 'daily');
                      form.setValue('due_date', null);
                    }
                  }}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-foreground">
                  Recorrente Diária Inegociável
                </FormLabel>
                <FormDescription className="text-muted-foreground">
                  Esta tarefa aparecerá no Dashboard Recorrentes todos os dias e rastreará seu streak.
                </FormDescription>
              </div>
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