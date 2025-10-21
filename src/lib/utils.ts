import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';
import { parseISO as dfnsParseISO, formatISO as dfnsFormatISO } from 'date-fns'; // Use aliases if needed, but they are usually imported from date-fns/esm
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

// Re-exporting parseISO and formatISO from date-fns directly, as they are available in the installed version.
export { parseISO, formatISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export function convertToUtc(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  return zonedTimeToUtc(dateObj, SAO_PAULO_TIME_ZONE);
}

export function convertToSaoPauloTime(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  return utcToZonedTime(dateObj, SAO_PAULO_TIME_ZONE);
}

export function formatDateTime(date: Date | string | null | undefined, includeTime: boolean = true): string {
  if (!date) return "N/A";
  const dateObj = date instanceof Date ? date : parseISO(date);
  const formatString = includeTime ? "PPP 'às' HH:mm" : "PPP";
  // Corrected format usage to pass locale as an options object
  return format(dateObj, formatString, { locale: ptBR });
}

export function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return "Sem horário";
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