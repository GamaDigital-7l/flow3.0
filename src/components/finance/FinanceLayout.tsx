"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageTitle from '@/components/layout/PageTitle';
import { DollarSign, Briefcase, User, Settings, BarChart3 } from 'lucide-react';
import PeriodSelector from './PeriodSelector';
import CompanyFinance from './CompanyFinance';
import PersonalFinance from './PersonalFinance';
import QuickTransactionEntry from './QuickTransactionEntry';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageWrapper from '@/components/layout/PageWrapper';
import FinanceSummary from './FinanceSummary';
import FinanceReport from './FinanceReport';

const FinanceLayout: React.FC = () => {
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'company' | 'personal'>('company');
  const [showReport, setShowReport] = useState(false);

  const handleTransactionAdded = () => {
    // This function is passed down to trigger refetches in children components
    // In a real app, this would typically invalidate react-query caches.
    // Since we don't have access to queryClient here, we rely on children to handle their own invalidation.
    // For demonstration, we can force a re-render or state change if needed, but relying on query invalidation is better.
  };

  return (
    <PageWrapper className="flex-1 flex flex-col">
      {/* Empilhando o título e a entrada rápida no mobile */}
      <div className="space-y-4 mb-6">
        <PageTitle title="Finanças" description="Gerencie as finanças pessoais e da empresa.">
          <Link to="/financial-management">
            <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
              <Settings className="mr-2 h-4 w-4" /> Gerenciar
            </Button>
          </Link>
        </PageTitle>
        <QuickTransactionEntry onTransactionAdded={handleTransactionAdded} />
      </div>

      <PeriodSelector currentPeriod={currentPeriod} onPeriodChange={setCurrentPeriod} />
      
      {/* Adicionando o componente FinanceSummary */}
      <FinanceSummary />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'company' | 'personal')} className="w-full mt-6">
        {/* Usando grid-cols-2 para garantir que as abas dividam o espaço igualmente */}
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
          <TabsTrigger value="company"><Briefcase className="mr-2 h-4 w-4" /> Empresa</TabsTrigger>
          <TabsTrigger value="personal"><User className="mr-2 h-4 w-4" /> Pessoal</TabsTrigger>
        </TabsList>
        
        <TabsContent value="company" className="mt-4">
          <CompanyFinance currentPeriod={currentPeriod} onTransactionAdded={handleTransactionAdded} />
        </TabsContent>
        
        <TabsContent value="personal" className="mt-4">
          {/* FIX TS2322: PersonalFinance agora aceita props */}
          <PersonalFinance currentPeriod={currentPeriod} onTransactionAdded={handleTransactionAdded} /> 
        </TabsContent>
      </Tabs>
      
      {/* Botão para exibir o relatório */}
      <Button onClick={() => setShowReport(!showReport)} className="mt-4">
        <BarChart3 className="mr-2 h-4 w-4" /> {showReport ? "Ocultar Relatório" : "Exibir Relatório"}
      </Button>

      {/* Renderização condicional do relatório */}
      {showReport && <FinanceReport />}
    </PageWrapper>
  );
};

export default FinanceLayout;