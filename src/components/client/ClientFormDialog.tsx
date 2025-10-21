import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ClientFormContent from './ClientFormContent';

interface ClientFormDialogProps {
  children: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: any; // Ajuste o tipo conforme necessário
  onClientSaved: () => void;
}

const ClientFormDialog: React.FC<ClientFormDialogProps> = ({
  children,
  isOpen,
  onOpenChange,
  initialData,
  onClientSaved,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Cliente</DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente.
          </DialogDescription>
        </DialogHeader>
        <ClientFormContent
          initialData={initialData}
          onClientSaved={onClientSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ClientFormDialog;