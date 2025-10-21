-- Tabela para armazenar informações dos clientes
CREATE TABLE clients (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    phone text,
    company text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Índices para otimização
CREATE INDEX idx_clients_user_id ON clients (user_id);
CREATE INDEX idx_clients_email ON clients (email);

-- RLS (Row Level Security)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policy para permitir que o usuário crie seus próprios clientes
CREATE POLICY "Users can create clients"
ON clients FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy para permitir que o usuário veja seus próprios clientes
CREATE POLICY "Users can view their own clients"
ON clients FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy para permitir que o usuário atualize seus próprios clientes
CREATE POLICY "Users can update their own clients"
ON clients FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy para permitir que o usuário delete seus próprios clientes
CREATE POLICY "Users can delete their own clients"
ON clients FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Função para atualizar a coluna updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();