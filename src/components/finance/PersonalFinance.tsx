import React from 'react';
import FinanceLayout from '@/components/finance/FinanceLayout';
import CompanyTransactionsList from './CompanyTransactionsList'; // Reutilizando o componente de lista para fins de demonstração

interface PersonalFinanceProps {
  currentPeriod: Date;
  onTransactionAdded: () => void;
}

// O componente PersonalFinance agora aceita os props esperados pelo FinanceLayout
const PersonalFinance: React.FC<PersonalFinanceProps> = ({ currentPeriod, onTransactionAdded }) => {
  // Em uma aplicação real, você teria um DashboardPessoal e uma PersonalTransactionsList
  // Para fins de correção de compilação, vamos apenas renderizar um placeholder ou um componente reutilizado.
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Pessoal (Em Desenvolvimento)</h2>
      <p className="text-muted-foreground">Aqui você veria o resumo das suas finanças pessoais.</p>
      
      {/* Reutilizando a lista de transações da empresa como placeholder para evitar a criação de um novo componente */}
      <CompanyTransactionsList currentPeriod={currentPeriod} onTransactionAdded={onTransactionAdded} />
    </div>
  );
};

export default PersonalFinance;