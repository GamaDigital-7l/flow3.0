import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import dateFnsParseISO from 'date-fns/parseISO';
import dateFnsFormat from 'date-fns/format';
import * as dateFnsTz from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

// Define local versions of parseISO and formatISO to avoid TS conflicts
export function parseISO(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  // dateFnsParseISO lida bem com strings ISO (YYYY-MM-DD)
  return dateFnsParseISO(dateString);
}

export function formatISO(date: Date): string {
  // Simple ISO formatting, relying on native Date toISOString
  return date.toISOString();
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Obtém a data local de hoje no formato YYYY-MM-DD, usando o fuso horário do navegador.
 */
export function getTodayLocalString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma data local (ou string) para uma data UTC pura (sem informação de tempo/fuso)
 * formatada como 'yyyy-MM-dd'. Isso é usado para salvar datas de vencimento no DB.
 * Retorna a data como se fosse UTC, mas sem alterar o dia.
 */
export function convertToUtc(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  // Se for uma data pura (sem hora), retorna a data. Se tiver hora, retorna a data.
  return dateObj; 
}

/**
 * Formata uma data para exibição no formato brasileiro (DD/MM/YYYY).
 */
export function formatDateTime(date: Date | string | null | undefined, includeTime: boolean = true): string {
  if (!date) return "N/A";
  const dateObj = date instanceof Date ? date : parseISO(date);
  
  // Se a data for uma string ISO pura (YYYY-MM-DD), parseISO a trata como UTC meia-noite.
  // Para exibição, precisamos garantir que ela seja tratada como data local.
  // Se for apenas data (sem hora), usamos 'dd/MM/yyyy'.
  
  const formatString = includeTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy";
  
  // Usamos dateFnsFormat com locale ptBR
  return dateFnsFormat(dateObj, formatString, { locale: ptBR }); 
}

/**
 * Formata apenas o horário (HH:mm).
 */
export function formatTime(timeString: string | null | undefined): string {
  if (timeString === null || timeString === undefined) return "Sem horário";
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch (e) {
    return timeString;
  }
}

export function getInitials(name: string): string {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9_.]/gi, '_').toLowerCase();
}

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};