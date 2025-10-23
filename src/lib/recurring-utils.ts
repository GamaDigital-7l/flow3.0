import { format, parseISO, startOfDay, subDays, addDays, getDay, differenceInDays } from 'https://esm.sh/date-fns@3.6.0';
import { utcToZonedTime, zonedTimeToUtc } from 'https://esm.sh/date-fns-tz@3.0.1';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Obtém a data local (YYYY-MM-DD) no fuso horário do usuário.
 */
export function getLocalDayString(date: Date, timezone: string): string {
  const zonedDate = utcToZonedTime(date, timezone);
  return format(zonedDate, 'yyyy-MM-dd');
}

/**
 * Converte uma data local (YYYY-MM-DD) para um objeto Date UTC que representa o início daquele dia no fuso horário do usuário.
 */
export function getUtcStartOfDay(dateLocalString: string, timezone: string): Date {
  // Cria uma data no fuso horário do usuário (ex: 2024-01-01T00:00:00-03:00)
  const zonedDate = parseISO(`${dateLocalString}T00:00:00`, { timeZone: timezone });
  // Converte para UTC (ex: 2024-01-01T03:00:00Z)
  return zonedTimeToUtc(zonedDate, timezone);
}

/**
 * Verifica se um dia é elegível com base na frequência e nos dias da semana.
 * @param dateLocalString Data no formato YYYY-MM-DD.
 * @param frequency 'daily' | 'weekly' | 'custom'
 * @param weekdays Array de números (0=Dom, 6=Sáb)
 */
export function isDayEligible(dateLocalString: string, frequency: string, weekdays: number[] | null): boolean {
  if (frequency === 'daily') {
    return true;
  }
  if (frequency === 'weekly' || frequency === 'custom') {
    if (!weekdays || weekdays.length === 0) return false;
    
    // parseISO trata a string YYYY-MM-DD como UTC 00:00:00, o que é seguro para obter o dia da semana
    // desde que não haja manipulação de fuso horário aqui.
    const date = parseISO(dateLocalString);
    const dayOfWeek = getDay(date); // 0 (Sunday) to 6 (Saturday)
    return weekdays.includes(dayOfWeek);
  }
  return false;
}

/**
 * Calcula o número total de dias elegíveis entre duas datas (inclusive).
 */
export function calculateEligibleDays(startDateLocal: string, endDateLocal: string, frequency: string, weekdays: number[] | null): number {
  let count = 0;
  let currentDate = parseISO(startDateLocal);
  const endDate = parseISO(endDateLocal);

  while (currentDate <= endDate) {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    if (isDayEligible(dateString, frequency, weekdays)) {
      count++;
    }
    currentDate = addDays(currentDate, 1);
  }
  return count;
}

/**
 * Calcula o streak (sequência de dias consecutivos concluídos).
 * A lógica de streak é complexa e deve ser feita olhando o histórico.
 * No backend, vamos simplificar: o streak é mantido na instância de HOJE.
 * Se HOJE foi concluído, o streak é atualizado. Se ONTEM falhou, o streak é resetado.
 */
export function calculateStreak(
  currentDateLocal: string, 
  lastCompletedDateLocal: string | null, 
  currentStreak: number,
  timezone: string
): { newStreak: number, streakBroken: boolean } {
  if (!lastCompletedDateLocal) {
    return { newStreak: 1, streakBroken: false };
  }

  const today = parseISO(currentDateLocal);
  const yesterday = subDays(today, 1);
  const lastCompleted = parseISO(lastCompletedDateLocal);

  // Verifica se a última conclusão foi exatamente ontem
  if (format(lastCompleted, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
    return { newStreak: currentStreak + 1, streakBroken: false };
  }
  
  // Se a última conclusão foi hoje (o que não deveria acontecer se a função for chamada APÓS a conclusão)
  if (format(lastCompleted, 'yyyy-MM-dd') === currentDateLocal) {
    return { newStreak: currentStreak, streakBroken: false };
  }

  // Se a última conclusão foi antes de ontem, o streak foi quebrado
  return { newStreak: 1, streakBroken: true };
}