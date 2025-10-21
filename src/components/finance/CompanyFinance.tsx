import React from 'react';
import CompanyProLabore from './CompanyProLabore';
import CompanyGoals from './CompanyGoals';
import CompanyBudgets from './CompanyBudgets';
import CompanyRecurrences from './CompanyRecurrences';
import CompanyTransactionsList from './CompanyTransactionsList';

interface CompanyFinanceProps {
  currentPeriod: Date;
  onTransactionAdded: () => void;
}

/**
 * Main component for company financial management.
 * It acts as a container for modular financial sections.
 */
const CompanyFinance: React.FC<CompanyFinanceProps> = ({ currentPeriod, onTransactionAdded }) => {
  return (
    <div className="space-y-6">
      {/* Pro Labore Settings */}
      <CompanyProLabore />

      {/* Goals */}
      <CompanyGoals />

      {/* Budgets */}
      <CompanyBudgets />

      {/* Recurrences */}
      <CompanyRecurrences />

      {/* Transactions List for the current period */}
      <CompanyTransactionsList
        currentPeriod={currentPeriod}
        onTransactionAdded={onTransactionAdded}
      />
    </div>
  );
};

export default CompanyFinance;