"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';

interface Question {
  id: string;
  text: string;
  type: "text" | "textarea" | "select" | "checkbox" | "number" | "date" | "email" | "phone" | "url";
  required: boolean;
  label?: string;
  placeholder?: string;
  options?: string[];
}

interface Briefing {
  id: string;
  title: string;
  description: string | null;
  form_structure: Question[];
  display_mode: 'all_questions' | 'one_by_one';
}

const fetchBriefing = async (briefingId: string): Promise<Briefing | null> => {
  const response = await fetch(`${supabaseUrl}/functions/v1/fetch-public-briefing?briefingId=${briefingId}`);
  
  if (response.status === 404) return null;
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Falha ao buscar formulário de briefing.");
  }
  
  const data = await response.json();
  return data as Briefing;
};

const BriefingPublicView: React.FC = () => {
  const { briefingId } = useParams<{ briefingId: string }>();
  const navigate = useNavigate();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const { data: briefing, isLoading, error } = useQuery<Briefing | null, Error>({
    queryKey: ['publicBriefing', briefingId],
    queryFn: () => fetchBriefing(briefingId!),
    enabled: !!briefingId,
    staleTime: Infinity,
  });

  const form = useForm();
  const { handleSubmit, control, formState: { isSubmitting, errors } } = form;

  const submitResponse = useMutation({
    mutationFn: async (response: any) => {
      const { data, error } = await supabase
        .from('briefing_responses')
        .insert({
          form_id: briefingId,
          response_data: response,
          client_name: response.client_name || 'Anônimo',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Resposta enviada com sucesso! Obrigado.");
      setIsSubmitted(true);
    },
    onError: (err: any) => {
      showError("Erro ao enviar resposta: " + err.message);
    },
  });

  const onSubmit = (data: any) => {
    // Validação manual para campos obrigatórios
    const validationErrors: Record<string, string> = {};
    briefing?.form_structure.forEach(q => {
      if (q.required) {
        const value = data[q.id];
        
        let isValid = true;
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
          isValid = false;
        }
        
        if (q.type === 'number' && (value === undefined || value === null || isNaN(Number(value)))) {
          isValid = false;
        }
        
        if (!isValid) {
          validationErrors[q.id] = "Este campo é obrigatório.";
        }
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      Object.keys(validationErrors).forEach(key => {
        form.setError(key as any, { type: 'manual', message: validationErrors[key] });
      });
      showError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    submitResponse.mutate(data);
  };

  const renderQuestionField = (question: Question) => {
    const fieldName = question.id;
    const labelText = question.label || question.text;
    const isRequired = question.required;

    return (
      <Controller
        key={fieldName}
        name={fieldName}
        control={control}
        defaultValue={question.type === 'checkbox' ? false : ''}
        render={({ field, fieldState: { error } }) => (
          <div className="space-y-2">
            <Label htmlFor={fieldName} className="text-foreground text-base font-medium">
              {labelText} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            {question.description && <p className="text-sm text-muted-foreground">{question.description}</p>}
            
            {/* Renderização do Input baseado no tipo */}
            {question.type === 'textarea' ? (
              <Textarea
                id={fieldName}
                placeholder={question.placeholder}
                className="bg-input border-border text-foreground focus-visible:ring-ring"
                value={field.value || ''}
                onChange={field.onChange}
              />
            ) : question.type === 'select' && question.options ? (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id={fieldName} className="bg-input border-border text-foreground focus-visible:ring-ring">
                  <SelectValue placeholder={question.placeholder || "Selecione uma opção"} />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  {question.options.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : question.type === 'checkbox' ? (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={fieldName}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <Label htmlFor={fieldName} className="text-sm font-normal">{question.placeholder || "Marque para confirmar"}</Label>
              </div>
            ) : question.type === 'date' ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {field.value ? formatDateTime(field.value, false) : <span>Selecione uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Input
                id={fieldName}
                type={question.type === 'number' ? 'number' : question.type === 'email' ? 'email' : question.type === 'phone' ? 'tel' : question.type === 'url' ? 'url' : 'text'}
                placeholder={question.placeholder}
                className="bg-input border-border text-foreground focus-visible:ring-ring"
                value={field.value || ''}
                onChange={field.onChange}
              />
            )}
            
            {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
          </div>
        )}
      />
    );
  };

  if (!briefingId) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">Link de Briefing Inválido.</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3">Carregando formulário...</p>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
        <Card className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-3">Erro de Acesso</h2>
          <p className="text-muted-foreground">O formulário de briefing não foi encontrado ou o link expirou.</p>
          <Button onClick={() => navigate('/')} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
        <Card className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Sucesso!</h2>
          <p className="text-muted-foreground">Sua resposta para o briefing "{briefing.title}" foi enviada com sucesso.</p>
        </Card>
      </div>
    );
  }

  const questions = briefing.form_structure;
  const isOneByOne = briefing.display_mode === 'one_by_one';
  const currentQuestion = isOneByOne ? questions[currentStep] : null;

  const handleNextStep = async () => {
    if (!currentQuestion) return;

    // Validação do passo atual
    const fieldName = currentQuestion.id;
    const isValid = await form.trigger(fieldName);

    if (isValid) {
      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        // Último passo, submeter
        handleSubmit(onSubmit)();
      }
    } else {
      showError("Por favor, preencha o campo obrigatório.");
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex justify-center">
      <Card className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-lg frosted-glass">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-3xl text-primary">{briefing.title}</CardTitle>
          {briefing.description && <CardDescription className="text-muted-foreground">{briefing.description}</CardDescription>}
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {isOneByOne ? (
              // Modo Passo a Passo
              <div key={currentStep} className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Passo {currentStep + 1} de {questions.length}
                </p>
                {currentQuestion && renderQuestionField(currentQuestion)}
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={handlePreviousStep} disabled={currentStep === 0}>
                    Anterior
                  </Button>
                  <Button type="button" onClick={handleNextStep} disabled={isSubmitting}>
                    {currentStep === questions.length - 1 ? (
                      isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Enviar Resposta</>
                    ) : (
                      "Próximo"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // Modo Todas as Perguntas
              <>
                {questions.map(renderQuestionField)}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Enviar Resposta</>}
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BriefingPublicView;