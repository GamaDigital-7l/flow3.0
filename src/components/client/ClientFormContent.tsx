"use client";

import React, { useState } from 'react';
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
import { Loader2, Image as ImageIcon, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sanitizeFilename } from '@/lib/utils';

const clientSchema = z.object({
  name: z.string().min(2, { message: 'O nome é obrigatório.' }),
  contact_email: z.string().email({ message: 'E-mail inválido.' }).optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  logo_url: z.string().url("URL da logo inválida.").optional().nullable(),
  logo_file: z.any().optional(), // Para lidar com FileList
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
      contact_email: initialData?.contact_email || '',
      contact_phone: initialData?.contact_phone || '',
      logo_url: initialData?.logo_url || '',
      monthly_delivery_goal: initialData?.monthly_delivery_goal || 0,
      type: initialData?.type || 'fixed',
    },
  });

  const clientType = watch('type');
  const [isUploading, setIsUploading] = useState(false);
  const currentLogoUrl = watch('logo_url');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const sanitizedFilename = sanitizeFilename(file.name);
      const filePath = `client_logos/${userId}/${Date.now()}-${sanitizedFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("client-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error("Erro ao fazer upload da logo: " + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("client-assets")
        .getPublicUrl(filePath);
      
      setValue('logo_url', publicUrlData.publicUrl, { shouldDirty: true });
      showSuccess("Logo adicionada com sucesso!");
    } catch (err: any) {
      showError("Erro ao fazer upload: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input file
    }
  };

  const handleRemoveLogo = () => {
    setValue('logo_url', null, { shouldDirty: true });
  };

  const mutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      if (!userId) throw new Error('Usuário não autenticado.');

      const clientData = {
        user_id: userId,
        name: data.name,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        logo_url: data.logo_url || null,
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
      
      {/* Logo Upload/URL */}
      <div className="space-y-2">
        <Label htmlFor="logo_file">Logo/Foto de Perfil (Opcional)</Label>
        {currentLogoUrl ? (
          <div className="flex flex-col gap-2 p-3 border border-border rounded-md bg-muted/20">
            <div className="flex items-center gap-3">
              <img src={currentLogoUrl} alt="Logo do Cliente" className="h-10 w-10 object-contain rounded-full flex-shrink-0" />
              <Input 
                id="logo_url" 
                {...register('logo_url')} 
                placeholder="URL da Logo" 
                className="flex-grow"
              />
              <Button type="button" variant="ghost" size="icon" onClick={handleRemoveLogo} className="text-red-500 hover:bg-red-500/10 flex-shrink-0">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            {errors.logo_url && <p className="text-sm text-destructive">{errors.logo_url.message}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input 
              id="logo_file" 
              type="file" 
              accept="image/*" 
              onChange={handleLogoUpload} 
              disabled={isUploading}
              className="col-span-1"
            />
            <Input 
              id="logo_url_input" 
              {...register('logo_url')} 
              placeholder="Ou cole a URL da Logo aqui" 
              className="col-span-1"
            />
          </div>
        )}
        {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary mt-1" />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_email">E-mail de Contato (Opcional)</Label>
        <Input id="contact_email" type="email" {...register('contact_email')} />
        {errors.contact_email && <p className="text-sm text-destructive">{errors.contact_email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact_phone">Telefone de Contato (Opcional)</Label>
        <Input id="contact_phone" {...register('contact_phone')} />
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
        <Button type="submit" disabled={mutation.isPending || isUploading}>
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