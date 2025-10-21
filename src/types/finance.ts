// Tipos de Escopo
export type FinancialScope = 'company' | 'personal';

// Tipos de Transação
export type FinancialTransactionType = 'income' | 'expense';

// Tipos de Frequência de Recorrência
export type RecurrenceFrequency = 'monthly' | 'weekly' | 'yearly' | 'quarterly';

// Interface de Categoria Financeira
export interface FinancialCategory {
  id: string;
  user_id: string;
  name: string;
  type: FinancialTransactionType;
  scope: FinancialScope;
  created_at: string;
}

// Interface de Conta Financeira
export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'cash';
  current_balance: number;
  scope: FinancialScope;
  created_at: string;
}

// Interface de Transação Financeira
export interface FinancialTransaction {
  id: string;
  user_id: string;
  date: string; // ISO date string
  description: string;
  amount: number;
  type: FinancialTransactionType;
  category_id: string | null;
  account_id: string;
  payment_method: string | null;
  client_id: string | null;
  is_recurrent_instance: boolean;
  created_at: string;
  // Relações (opcionais, para joins)
  category?: FinancialCategory;
  account?: FinancialAccount;
  client?: { id: string; name: string };
}

// Interface de Recorrência Financeira
export interface FinancialRecurrence {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: FinancialTransactionType;
  frequency: RecurrenceFrequency;
  next_due_date: string; // ISO date string
  category_id: string | null;
  account_id: string;
  is_active: boolean;
  created_at: string;
  // Relações (opcionais, para joins)
  category?: FinancialCategory;
  account?: FinancialAccount;
}

// Interface de Orçamento
export interface FinancialBudget {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  type: FinancialTransactionType;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  category_id: string | null;
  scope: FinancialScope;
  created_at: string;
  // Relações (opcionais, para joins)
  category?: FinancialCategory;
  spent_amount?: number; // Calculado
}

// Interface de Meta Financeira
export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null; // ISO date string
  linked_account_id: string | null;
  created_at: string;
  // Relações (opcionais, para joins)
  linked_account?: FinancialAccount;
}

export interface RecurringTransaction {
    id: string;
    description: string;
    amount: number;
    type: FinancialTransactionType;
    account_id: string;
    category_id?: string | null;
    client_id?: string | null;
    recurrence_type: string;
    start_date: string;
    is_active: boolean;
    account?: { name: string }[];
    category?: { name: string };
    client?: { name: string };
}