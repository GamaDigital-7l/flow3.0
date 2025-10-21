import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

// Variáveis de ambiente (assumindo que estão configuradas)
const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Envia uma notificação para o Telegram (assumindo que o chat_id está armazenado no perfil do usuário).
 * @param userId ID do usuário
 * @param message Mensagem a ser enviada
 */
export async function sendTelegramNotification(userId: string, message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN não configurado. Pulando notificação Telegram.");
    return;
  }

  try {
    // 1. Buscar o chat_id do usuário no perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.telegram_chat_id) {
      console.warn(`Chat ID do Telegram não encontrado para o usuário ${userId}.`);
      return;
    }

    const chat_id = profile.telegram_chat_id;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro ao enviar Telegram: ${errorData.description || response.statusText}`);
    }

    console.log("Notificação Telegram enviada com sucesso.");

  } catch (error: any) {
    console.error("Falha ao enviar notificação Telegram:", error.message);
    // Não mostrar toast de erro para o usuário final, apenas logar.
  }
}

/**
 * Envia uma notificação Web Push (requer um Edge Function ou serviço de backend para segurança).
 * NOTA: O envio real de Web Push deve ser feito por um servidor/Edge Function para proteger a chave VAPID privada.
 * Este serviço apenas simula a chamada para um endpoint de Edge Function.
 * @param userId ID do usuário
 * @param title Título da notificação
 * @param body Corpo da notificação
 */
export async function sendWebPushNotification(userId: string, title: string, body: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VAPID_PUBLIC_KEY não configurada. Pulando notificação Web Push.");
    return;
  }

  try {
    // Assumindo que existe um Edge Function no Supabase para lidar com o envio seguro
    const { data, error } = await supabase.functions.invoke('send-web-push', {
      body: { userId, title, body },
    });

    if (error) throw error;

    console.log("Notificação Web Push solicitada com sucesso.", data);

  } catch (error: any) {
    console.error("Falha ao solicitar notificação Web Push:", error.message);
  }
}

/**
 * Função unificada para enviar todas as notificações.
 */
export async function sendNotification(userId: string, message: string, title?: string): Promise<void> {
  // Envio para Telegram
  await sendTelegramNotification(userId, message);

  // Envio para Web Push (se o título for fornecido)
  if (title) {
    await sendWebPushNotification(userId, title, message);
  }
}