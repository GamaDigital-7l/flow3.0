import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageTitle from '@/components/layout/PageTitle';
import { DollarSign, Briefcase, User } from 'lucide-react';
import PeriodSelector from './PeriodSelector';
import CompanyDashboard from './CompanyDashboard';
import PersonalFinance from './PersonalFinance';
import QuickTransactionEntry from './QuickTransactionEntry';

const FinanceLayout: React.FC = () => {
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'company' | 'personal'>('company');

  const handleTransactionAdded = () => {
    // This function is passed down to trigger refetches in children components
    // In a real app, this would typically invalidate react-query caches.
    // Since we don't have access to queryClient here, we rely on children to handle their own invalidation.
    // For demonstration, we can force a re-render or state change if needed, but relying on query invalidation is better.
  };

  return (
    <div className="p-4 md:p-8">
      <PageTitle title="Finanças" description="Gerencie as finanças pessoais e da empresa.">
        <QuickTransactionEntry onTransactionAdded={handleTransactionAdded} />
      </PageTitle>

      <PeriodSelector currentPeriod={currentPeriod} onPeriodChange={setCurrentPeriod} />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'company' | 'personal')} className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
          <TabsTrigger value="company"><Briefcase className="mr-2 h-4 w-4" /> Empresa</TabsTrigger>
          <TabsTrigger value="personal"><User className="mr-2 h-4 w-4" /> Pessoal</TabsTrigger>
        </TabsList>
        
        <TabsContent value="company" className="mt-4">
          <CompanyDashboard currentPeriod={currentPeriod} onTransactionAdded={handleTransactionAdded} />
        </TabsContent>
        
        <TabsContent value="personal" className="mt-4">
          {/* FIX TS2322: PersonalFinance agora aceita props */}
          <PersonalFinance currentPeriod={currentPeriod} onTransactionAdded={handleTransactionAdded} /> 
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceLayout;