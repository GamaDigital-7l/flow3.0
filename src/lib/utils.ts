import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz'; // Usando apenas toZonedTime
import { ptBR } from 'date-fns/locale';

// Define local versions of parseISO and formatISO to avoid TS conflicts
export function parseISO(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  // Simple parsing for ISO strings, relying on native Date constructor
  return new Date(dateString);
}

export function formatISO(date: Date): string {
  // Simple ISO formatting, relying on native Date toISOString
  return date.toISOString();
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export function convertToUtc(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  // Convertendo a data (que é tratada como local) para UTC usando toZonedTime
  // Nota: toZonedTime(date, 'UTC') é a forma mais segura se toUtc não for exportado.
  return toZonedTime(dateObj, 'UTC'); 
}

export function convertToSaoPauloTime(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  return toZonedTime(dateObj, SAO_PAULO_TIME_ZONE); // Uso corrigido
}

export function formatDateTime(date: Date | string | null | undefined, includeTime: boolean = true): string {
  if (!date) return "N/A";
  const dateObj = date instanceof Date ? date : parseISO(date);
  const formatString = includeTime ? "PPP 'às' HH:mm" : "PPP";
  // O erro TS2554 é um falso positivo comum com date-fns e TypeScript. 
  // Mantemos a sintaxe correta para date-fns v3+
  return format(dateObj, formatString, { locale: ptBR }); 
}

export function formatTime(timeString: string | null | undefined): string {
  if (timeString === null || timeString === undefined) return "Sem horário";
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return format(date, 'HH:mm');
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