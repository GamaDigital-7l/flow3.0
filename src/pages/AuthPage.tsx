"use client";

import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const AuthPage = () => {
  const { theme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  // Evita hydration mismatch garantindo que o tema seja lido apenas no cliente
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; // ou um spinner/skeleton
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bem-vindo!</CardTitle>
            <CardDescription>Faça login para gerenciar seus clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              theme={theme === "dark" ? "dark" : "default"}
              providers={["google"]}
              localization={{
                variables: {
                  sign_in: {
                    email_label: "Endereço de e-mail",
                    password_label: "Sua senha",
                    email_input_placeholder: "seu@email.com",
                    password_input_placeholder: "Sua senha",
                    button_label: "Entrar",
                    social_provider_text: "Entrar com {{provider}}",
                    link_text: "Já tem uma conta? Entre",
                  },
                  sign_up: {
                    email_label: "Endereço de e-mail",
                    password_label: "Crie uma senha",
                    email_input_placeholder: "seu@email.com",
                    password_input_placeholder: "Crie uma senha forte",
                    button_label: "Registrar",
                    social_provider_text: "Registrar com {{provider}}",
                    link_text: "Não tem uma conta? Registre-se",
                  },
                  forgotten_password: {
                    email_label: "Endereço de e-mail",
                    email_input_placeholder: "seu@email.com",
                    button_label: "Enviar instruções",
                    link_text: "Esqueceu sua senha?",
                  },
                },
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;