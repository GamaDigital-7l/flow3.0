"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { supabase, VAPID_PUBLIC_KEY } from '@/integrations/supabase/client';
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

const WebPushToggle: React.FC = () => {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSessionLoading && userId) {
      checkSubscriptionStatus();
    }
  }, [isSessionLoading, userId]);

  const updateWebPushSetting = async (enabled: boolean) => {
    if (!userId) return;
    try {
      const { data: existingSetting, error: fetchError } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingSetting) {
        const { error: updateError } = await supabase
          .from('settings')
          .update({ webpush_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('id', existingSetting.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('settings')
          .insert({ user_id: userId, webpush_enabled: enabled });
        if (insertError) throw insertError;
      }
    } catch (err: any) {
      console.error("Erro ao atualizar configuração webpush_enabled:", err);
      showError("Erro ao salvar preferência de notificação.");
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSubscribed(false); // Not supported
      return;
    }
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error("Erro ao verificar status da inscrição:", err);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeUser = async () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para ativar as notificações.");
      return;
    }
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showError('Permissão de notificação negada. As notificações push não funcionarão.');
        setIsLoading(false);
        setIsSubscribed(false);
        await updateWebPushSetting(false); // Desabilitar no DB
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
          showError("Chave pública VAPID não configurada. Verifique seu arquivo .env.");
          setIsLoading(false);
          return;
        }
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // Salva a inscrição no banco de dados do Supabase
      const { data: existingSubscription, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw fetchError;
      }

      if (existingSubscription) {
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({ subscription: subscription.toJSON(), updated_at: new Date().toISOString() })
          .eq('id', existingSubscription.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({ user_id: userId, subscription: subscription.toJSON() });
        if (insertError) throw insertError;
      }
      showSuccess('Inscrito para notificações push!');
      setIsSubscribed(true);
      await updateWebPushSetting(true); // Habilitar no DB
    } catch (err: any) {
      console.error('Erro ao inscrever o usuário para notificações push:', err);
      showError('Erro ao configurar notificações push: ' + err.message);
      setIsSubscribed(false);
      await updateWebPushSetting(false); // Desabilitar no DB em caso de erro
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        // Remove a inscrição do banco de dados
        const { error: deleteError } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('subscription', subscription.toJSON());
        if (deleteError) throw deleteError;
      }
      showSuccess('Desinscrito das notificações push.');
      setIsSubscribed(false);
      await updateWebPushSetting(false); // Desabilitar no DB
    } catch (err: any) {
      console.error('Erro ao desinscrever o usuário:', err);
      showError('Erro ao desativar notificações push: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || isSessionLoading || isSubscribed === null) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando status...
      </Button>
    );
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return (
      <p className="text-sm text-muted-foreground text-red-500">
        Notificações Push não são suportadas neste navegador.
      </p>
    );
  }

  return (
    <>
      {isSubscribed ? (
        <Button onClick={unsubscribeUser} disabled={isLoading} className="w-full bg-red-600 text-white hover:bg-red-700">
          <BellOff className="mr-2 h-4 w-4" />
          {isLoading ? "Desativando..." : "Desativar Notificações Web Push"}
        </Button>
      ) : (
        <Button onClick={subscribeUser} disabled={isLoading} className="w-full bg-green-600 text-white hover:bg-green-700">
          <BellRing className="mr-2 h-4 w-4" />
          {isLoading ? "Ativando..." : "Ativar Notificações Web Push"}
        </Button>
      )}
    </>
  );
};

export default WebPushToggle;