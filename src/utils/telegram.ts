import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

export const sendDailyTelegramSummary = async (userId: string, timeOfDay: 'morning' | 'evening') => {
  try {
    const { data, error } = await supabase.functions.invoke('telegram-daily-summary', {
      body: { userId, timeOfDay },
    });

    if (error) {
      throw error;
    }

    showSuccess(`Resumo do Telegram enviado (${timeOfDay})!`);
    console.log(`Telegram summary sent (${timeOfDay}):`, data);
  } catch (error: any) {
    showError("Erro ao enviar resumo do Telegram: " + error.message);
    console.error("Error sending Telegram summary:", error);
  }
};