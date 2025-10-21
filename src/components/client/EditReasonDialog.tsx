"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

interface EditReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  initialReason?: string | null;
}

const EditReasonDialog: React.FC<EditReasonDialogProps> = ({ isOpen, onClose, onSubmit, initialReason }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(initialReason || '');
    }
  }, [isOpen, initialReason]);

  const handleSubmit = () => {
    if (reason.trim()) {
      onSubmit(reason);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
        <DialogHeader>
          <DialogTitle>Solicitar Edição</DialogTitle>
          <DialogDescription>
            Por favor, descreva o motivo da solicitação de edição. Isso ajudará a entender o que precisa ser ajustado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="reason">
              Motivo
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Por favor, altere a cor de fundo para azul."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!reason.trim()}>Enviar Solicitação</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditReasonDialog;