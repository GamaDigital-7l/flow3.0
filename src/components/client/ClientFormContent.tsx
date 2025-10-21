"use client";

import React from 'react';
import { Client } from '@/types/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showSuccess, showError } from "@/utils/toast";
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const clientSchema = z.object({
  name: z.string().min(2, { message: 'O nome é obrigatório.' }),
  email: z.string().email({ message: 'E-mail inválido.' }),
  phone: z.string().optional().nullable(),
  // company: z.string().optional().nullable(), // Removido
  monthly_delivery_goal: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().int().min(0, "A meta deve ser um número positivo.").default(0)
  ),
  type: z.enum(['fixed', 'freela', 'agency']).default('fixed'),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormContentProps {
  initialData: Client | null;
  onClientSaved: () => void;
  onClose: () => void;
}

const ClientFormContent: React.FC<ClientFormContentProps> = ({
  initialData,
  onClientSaved,
  onClose,
}) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.contact_email || initialData?.email || '',
      phone: initialData?.contact_phone || initialData?.phone || '',
      // company: initialData?.company || '', // Removido
      monthly_delivery_goal: initialData?.monthly_delivery_goal || 0,
      type: initialData?.type || 'fixed',
    },
  });

  const clientType = watch('type');

  const mutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      if (!userId) throw new Error('Usuário não autenticado.');

      const clientData = {
        ...data,
        user_id: userId,
        contact_email: data.email,
        contact_phone: data.phone,
        // company: data.company || null, // Removido
        monthly_delivery_goal: data.monthly_delivery_goal,
        type: data.type,
      };

      if (initialData) {
        // Update
        const { data: updatedData, error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', initialData.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return updatedData;
      } else {
        // Create
        const { data: newData, error } = await supabase
          .from('clients')
          .insert(clientData)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return newData;
      }
    },
    onSuccess: () => {
      showSuccess(`Cliente ${initialData ? 'atualizado' : 'criado'} com sucesso!`);
      onClientSaved();
      onClose();
    },
    onError: (err) => {
      showError('Erro ao salvar cliente: ' + err.message);
    },
  });

  const onSubmit = (data: ClientFormData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome Completo</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      {/* <div className="space-y-2">
        <Label htmlFor="company">Empresa (Opcional)</Label>
        <Input id="company" {...register('company')} />
      </div> */}
      <div className="space-y-2">
        <Label htmlFor="email">E-mail de Contato</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone de Contato (Opcional)</Label>
        <Input id="phone" {...register('phone')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo de Cliente</Label>
          <Select
            onValueChange={(value: 'fixed' | 'freela' | 'agency') => setValue('type', value)}
            value={clientType}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixo (Mensal)</SelectItem>
              <SelectItem value="freela">Freela (Projeto)</SelectItem>
              <SelectItem value="agency">Agência (Terceirizado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="monthly_delivery_goal">Meta Mensal (Entregas)</Label>
          <Input 
            id="monthly_delivery_goal" 
            type="number" 
            min="0"
            {...register('monthly_delivery_goal', { valueAsNumber: true })} 
            disabled={clientType !== 'fixed'}
          />
          {errors.monthly_delivery_goal && <p className="text-sm text-destructive">{errors.monthly_delivery_goal.message}</p>}
          {clientType !== 'fixed' && <p className="text-xs text-muted-foreground">A meta é aplicável apenas a clientes fixos.</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : initialData ? (
            'Salvar Alterações'
          ) : (
            'Criar Cliente'
          )}
        </Button>
      </div>
    </form>
  );
};

export default ClientFormContent;