import React from 'react';
import PageWrapper from './PageWrapper';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

// DashboardWrapper agora apenas envolve o PageWrapper, mantendo a semântica
const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  return (
    <PageWrapper>
      {children}
    </PageWrapper>
  );
};

export default DashboardWrapper;