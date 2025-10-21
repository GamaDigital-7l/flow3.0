"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { ptBR } from "date-fns/locale";

interface SettingsFormValues {
  groq_api_key?: string | null;
  openai_api_key?: string | null;
  ai_provider_preference: "groq" | "openai";
  notification_channel: "web_push" | "none";
}

interface AISettingsCardProps {
  form: UseFormReturn<SettingsFormValues>;
  onSubmit: (values: SettingsFormValues) => Promise<void>;
}

const AISettingsCard: React.FC<AISettingsCardProps> = ({ form, onSubmit }) => {
  return (
    <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader>
        <CardTitle className="text-foreground">Chaves de API e Preferências de IA</CardTitle>
        <CardDescription className="text-muted-foreground">
          Insira suas chaves de API e escolha seu provedor de IA preferido.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="groq_api_key" className="text-foreground">Groq API Key (Grátis)</Label>
            <Input
              id="groq_api_key"
              {...form.register("groq_api_key")}
              placeholder="Sua chave da Groq API"
              className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
            />
            {form.formState.errors.groq_api_key && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.groq_api_key.message}
              </p>
            )}
          </div>
          <div className="mt-4">
            <Label htmlFor="openai_api_key" className="text-foreground">OpenAI (ChatGPT) API Key (Pago)</Label>
            <Input
              id="openai_api_key"
              {...form.register("openai_api_key")}
              placeholder="Sua chave da OpenAI API"
              className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
            />
            {form.formState.errors.openai_api_key && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.openai_api_key.message}
              </p>
            )}
          </div>
          <div className="mt-4">
            <Label htmlFor="ai_provider_preference" className="text-foreground">Provedor de IA Preferido</Label>
            <Select
              onValueChange={(value: "groq" | "openai") =>
                form.setValue("ai_provider_preference", value)
              }
              value={form.watch("ai_provider_preference")}
            >
              <SelectTrigger id="ai_provider_preference" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                <SelectValue placeholder="Selecionar provedor de IA" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                <SelectItem value="groq">Groq (Grátis)</SelectItem>
                <SelectItem value="openai">OpenAI (ChatGPT - Pago)</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.ai_provider_preference && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.ai_provider_preference.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Salvar Configurações</Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AISettingsCard;