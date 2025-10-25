import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
          <CardDescription>
            Faça login para acessar o painel de controle da Gama.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder para o formulário de login */}
          <div className="flex flex-col space-y-4">
            <p className="text-sm text-muted-foreground">
              O formulário de login será implementado aqui.
            </p>
            <p className="text-sm text-primary font-medium">
              (Redirecionamento automático para /dashboard após login)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}