import { format, formatISO, parseISO, toDate, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDateTime = (date: string | null | undefined, showTime: boolean = true): string => {
  if (!date) return 'Sem data';
  try {
    const parsedDate = parseISO(date);
    if (!parsedDate) return 'Data inválida';
    const saoPauloTime = utcToZonedTime(parsedDate, 'America/Sao_Paulo');
    return format(saoPauloTime, showTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale: ptBR });
  } catch (error) {
    console.error("Erro ao formatar data:", error);
    return 'Data inválida';
  }
};

export const convertToSaoPauloTime = (date: Date | string | null | undefined): Date | null => {
  if (!date) return null;
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    if (!parsedDate) return null;
    return utcToZonedTime(parsedDate, 'America/Sao_Paulo');
  } catch (error) {
    console.error("Erro ao converter para fuso horário de São Paulo:", error);
    return null;
  }
};

export const convertToUtc = (date: Date | string | null | undefined): Date | null => {
  if (!date) return null;
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    if (!parsedDate) return null;
    return zonedTimeToUtc(parsedDate, 'America/Sao_Paulo');
  } catch (error) {
    console.error("Erro ao converter para UTC:", error);
    return null;
  }
};

export const formatTime = (timeString: string | null | undefined): string => {
  if (!timeString) return '00:00';
  try {
    const [hours, minutes] = timeString.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  } catch (error) {
    console.error("Erro ao formatar hora:", error);
    return '00:00';
  }
};