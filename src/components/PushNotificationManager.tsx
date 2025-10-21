"use client";

import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';

// Função utilitária para converter base64 para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PushNotificationManager: React.FC = () => {
  // Este componente agora apenas garante que o service worker está registrado.
  // A lógica de inscrição/desinscrição para notificações push será movida para WebPushToggle.tsx
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      // console.warn('Service Workers não são suportados neste navegador.'); // Removido console.warn
      return;
    }

    // O registro do service worker já é feito em main.tsx,
    // mas podemos adicionar uma verificação aqui se necessário.
    // Por enquanto, este componente pode ser simplificado ou removido se não tiver outras responsabilidades.
    // Para manter a estrutura, ele apenas loga que está ativo.
    // console.log('PushNotificationManager ativo: Service Worker registrado.'); // Removido console.log
  }, []);

  return null; // Este componente não renderiza nada visível
};

export default PushNotificationManager;