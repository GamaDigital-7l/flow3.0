"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, XCircle, Trash2, Users, Settings, AlertTriangle, UserPlus, UserMinus } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { cn, sanitizeFilename, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";

// Tipos simplificados
interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  monthly_delivery_goal: number;
}

interface WorkspaceMember {
  client_id: string;
  user_id: string;
  role: string;
  profile: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

const clientSchema = z.object({
  name: z.string().min(1, "O nome do cliente é obrigatório."),
  description: z.string().nullable().optional(),
  contact_email: z.string().email("Email inválido.").nullable().optional().or(z.literal("")),
  contact_phone: z.string().nullable().optional().or(z.literal("")),
  monthly_delivery_goal: z.number().int().min(0).default(0),
  group_id: z.string().nullable().optional().or(z.literal("")), // Placeholder para ID do Grupo
});

export type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  initialData?: Client;
  onClientSaved: () => void;
  onClose: () => void;
}

const fetchWorkspaceMembers = async (clientId: string): Promise<WorkspaceMember[]> => {
  const { data, error } = await supabase
    .from("client_workspace_members")
    .select(`
      client_id, user_id, role,
      profile:auth.users(first_name, last_name, avatar_url)
    `)
    .eq("client_id", clientId);

  if (error) throw error;
  return data as any[] || [];
};

const ClientForm: React.FC<ClientFormProps> = ({ initialData, onClientSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialData?.logo_url || null);
  const [activeTab, setActiveTab] = useState('general');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const { data: members, isLoading: isLoadingMembers, refetch: refetchMembers } = useQuery<WorkspaceMember[], Error>({
    queryKey: ["workspaceMembers", initialData?.id],
    queryFn: () => fetchWorkspaceMembers(initialData!.id),
    enabled: !!userId && !!initialData?.id,
  });

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || null,
      contact_email: initialData?.contact_email || null,
      contact_phone: initialData?.contact_phone || null,
      monthly_delivery_goal: initialData?.monthly_delivery_goal || 0,
      group_id: "", // Implementação futura
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    try {
      const sanitizedFilename = sanitizeFilename(file.name);
      const filePath = `client_logos/${initialData?.id || 'new'}/${Date.now()}-${sanitizedFilename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw new Error("Erro ao fazer upload da logo: " + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from("client-assets")
        .getPublicUrl(filePath);

      setLogoUrl(publicUrlData.publicUrl);
      showSuccess("Logo enviada com sucesso!");
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // Deletar tarefas e tags associadas (ON DELETE CASCADE deve cuidar disso)
      await supabase.from("client_tasks").delete().eq("client_id", clientId);
      
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cliente deletado permanentemente!");
      queryClient.invalidateQueries({ queryKey: ["clients", userId] });
      onClose();
    },
    onError: (err: any) => {
      showError("Erro ao deletar cliente: " + err.message);
    },
  });

  const onSubmit = async (values: ClientFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        name: values.name,
        description: values.description || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        monthly_delivery_goal: values.monthly_delivery_goal,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("clients")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clients").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
        showSuccess("Cliente adicionado com sucesso!");
      }
      
      onClientSaved();
    } catch (error: any) {
      showError("Erro ao salvar cliente: " + error.message);
      console.error("Erro ao salvar cliente:", error);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 bg-muted text-muted-foreground">
        <TabsTrigger value="general"><Settings className="mr-2 h-4 w-4" /> Geral</TabsTrigger>
        <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" /> Membros</TabsTrigger>
        <TabsTrigger value="danger"><AlertTriangle className="mr-2 h-4 w-4" /> Zona de Perigo</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Logo e Upload */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16 flex-shrink-0">
                <AvatarImage src={logoUrl || undefined} alt={form.watch('name')} />
                <AvatarFallback className="text-xl bg-primary/20 text-primary">{getInitials(form.watch('name') || 'Novo')}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <Label htmlFor="logo-upload" className="text-foreground">Logo do Cliente</Label>
                <Input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploading} />
                {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary mt-1" />}
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cliente</FormLabel>
                  <FormControl><Input placeholder="Ex: Woe Comunicação" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (Opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Detalhes sobre o cliente..." {...field} value={field.value || ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone WhatsApp</FormLabel>
                    <FormControl><Input placeholder="Ex: +55 31 99999-9999" {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthly_delivery_goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Mensal de Entregas</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={form.formState.isSubmitting || isUploading}>
              {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Atualizar Cliente" : "Adicionar Cliente")}
            </Button>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value="members" className="mt-4 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Gerenciar Membros</h3>
        {isLoadingMembers ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : members && members.length > 0 ? (
          <div className="space-y-2">
            {members.map(member => (
              <div key={`${member.client_id}-${member.user_id}`} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.profile?.avatar_url || undefined} alt={member.profile?.first_name || 'Avatar'} />
                    <AvatarFallback className="text-sm bg-primary/20 text-primary">{getInitials(member.profile?.first_name || 'Membro')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">{member.profile?.first_name} {member.profile?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhum membro adicionado a este workspace.</p>
        )}

        <div className="flex items-center space-x-2">
          <Input
            type="email"
            placeholder="Email do novo membro"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            className="flex-1 bg-input border-border text-foreground focus-visible:ring-ring"
          />
          <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
            <UserPlus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="danger" className="mt-4 space-y-4">
        <h3 className="text-lg font-semibold text-red-500">Zona de Perigo</h3>
        <Card className="border-red-500 bg-red-500/10">
          <CardHeader>
            <CardTitle className="text-red-500">Deletar Cliente</CardTitle>
            <CardDescription className="text-red-400">
              Esta ação é irreversível. Todas as tarefas, histórico e dados associados a este cliente serão permanentemente excluídos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {initialData?.id ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" /> Deletar Cliente Permanentemente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirma a exclusão?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você está prestes a deletar o cliente "{initialData.name}". Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteClient.mutate(initialData.id)} className="bg-red-600 hover:bg-red-700">
                      Deletar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="destructive" disabled className="w-full">
                Deletar Cliente (Disponível após a criação)
              </Button>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default ClientForm;