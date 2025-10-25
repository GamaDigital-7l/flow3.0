import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError } from '@/utils/toast';

interface EncryptionPayload {
  action: 'encrypt' | 'decrypt';
  secret?: string;
  encryptedSecret?: string;
}

interface EncryptionResponse {
  encryptedSecret?: string;
  secret?: string;
}

const encryptVaultSecret = async (payload: EncryptionPayload): Promise<EncryptionResponse> => {
  const { data, error } = await supabase.functions.invoke('encrypt-vault-secret', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message);
  }
  
  // A Edge Function retorna { encryptedSecret: string } ou { secret: string }
  return data as EncryptionResponse;
};

export const useVaultEncryption = () => {
  const { session } = useSession();
  
  const encryptionMutation = useMutation({
    mutationFn: encryptVaultSecret,
    onError: (error: any) => {
      showError("Erro de segurança: " + error.message);
    },
  });

  return encryptionMutation;
};