import React from 'react';
import { Client } from '@/types/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import ClientFormContent from './ClientFormContent'; // Import the new content component
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

interface ClientFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: Client | null;
  onClientSaved: () => void;
  children: React.ReactNode;
}

const ClientFormDialog: React.FC<ClientFormDialogProps> = ({
  isOpen,
  onOpenChange,
  initialData,
  onClientSaved,
  children,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>
            {initialData ? 'Ajuste as informações do cliente.' : 'Preencha os detalhes para adicionar um novo cliente.'}
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