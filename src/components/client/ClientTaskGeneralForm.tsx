"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import TagSelector from "../TagSelector";
import TimePicker from "../TimePicker";
import { CalendarIcon } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { ptBR } from "date-fns/locale/pt-BR";
import { ClientTaskFormValues } from "./ClientTaskForm"; // Importando o tipo do arquivo principal

interface User {
  id: string;
  first_name: string;
  last_name: string;
}

interface ClientTaskGeneralFormProps {
  users: User[] | undefined;
  isLoadingUsers: boolean;
  publicApprovalLink: string | null;
}

const ClientTaskGeneralForm: React.FC<ClientTaskGeneralFormProps> = ({
  users,
  publicApprovalLink,
}) => {
  const form = useFormContext<ClientTaskFormValues>();

  return (
    <div className="space-y-4">
      {/* Título */}
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Título</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Post para Instagram" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Descrição */}
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição (Legenda)</FormLabel>
            <FormControl>
              <Textarea placeholder="Detalhes da entrega/legenda..." {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Data e Hora */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="due_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data de Vencimento</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      {field.value ? (
                        formatDateTime(field.value, false)
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
        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horário (Opcional)</FormLabel>
              <FormControl>
                <TimePicker
                  value={field.value || null}
                  onChange={(time) => field.onChange(time || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Responsável e Status */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="responsible_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responsável (Opcional)</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                value={field.value || '__none__'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {users?.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="in_progress">Em Produção</SelectItem>
                  <SelectItem value="under_review">Para Aprovação</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="posted">Postado/Concluído</SelectItem>
                  <SelectItem value="edit_requested">Edição Solicitada</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Tags */}
      <TagSelector
        selectedTagIds={form.watch("selected_tag_ids") || []}
        onTagSelectionChange={(ids) => form.setValue("selected_tag_ids", ids, { shouldDirty: true })}
      />

      {/* Aprovação Pública */}
      <FormField
        control={form.control}
        name="public_approval_enabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>
                Habilitar Aprovação Pública
              </FormLabel>
              <FormDescription className="text-muted-foreground">
                Permite que o cliente aprove ou solicite edição via link público.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />

      {publicApprovalLink && (
        <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-200 rounded-md">
          <LinkIcon className="h-4 w-4 text-green-600" />
          <a href={publicApprovalLink} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 hover:underline">
            Link de Aprovação Pública: {publicApprovalLink}
          </a>
        </div>
      )}
    </div>
  );
};

export default ClientTaskGeneralForm;