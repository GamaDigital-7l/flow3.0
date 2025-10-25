"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

const TriggerDailyResetButton = () => {
  const triggerDailyReset = async () => {
    const { data, error } = await supabase.functions.invoke('daily-reset');
    if (error) {
      console.error("Erro ao acionar daily-reset:", error);
      showError("Erro ao acionar daily-reset: " + error.message);
    } else {
      console.log("Daily reset acionado com sucesso:", data);
      showSuccess("Daily reset acionado com sucesso!");
    }
  };

  return (
    <Button onClick={triggerDailyReset}>
      Acionar Daily Reset
    </Button>
  );
};

export default TriggerDailyResetButton;