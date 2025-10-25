import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

export const sendDailyTelegramSummary = async (userId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('telegram-daily-summary', {
      body: { userId },
    });

    if (error) {
      throw error;
    }

    showSuccess("Resumo diário do Telegram enviado!");
    console.log("Telegram summary sent:", data);
  } catch (error: any) {
    showError("Erro ao enviar resumo do Telegram: " + error.message);
    console.error("Error sending Telegram summary:", error);
  }
};