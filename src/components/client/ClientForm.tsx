import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const clientSchema = z.object({
  name: z.string().min(2, { message: 'O nome é obrigatório.' }),
  email: z.string().email({ message: 'E-mail inválido.' }),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: Client | null;
  onClientSaved: () => void;
  children: React.ReactNode;
}

const ClientFormDialog: React.FC<ClientFormDialogProps> = ({
  isOpen,
  onOpenChange,
  initialData,
  onClientSaved,
  children,
}) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData || { name: '', email: '', phone: '', company: '' },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset(initialData || { name: '', email: '', phone: '', company: '' });
    }
  }, [isOpen, initialData, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      if (!userId) throw new Error('Usuário não autenticado.');

      const clientData = {
        ...data,
        user_id: userId,
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
    },
    onError: (err) => {
      showError('Erro ao salvar cliente: ' + err.message);
    },
  });

  const onSubmit = (data: ClientFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>
            {initialData ? 'Ajuste as informações do cliente.' : 'Preencha os detalhes para adicionar um novo cliente.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (Opcional)</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Empresa (Opcional)</Label>
            <Input id="company" {...register('company')} />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClientFormDialog;