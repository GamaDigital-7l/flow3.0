import React from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, GripVertical } from 'lucide-react';
import { ProposalFormValues } from './ProposalForm';
import { cn } from '@/lib/utils';

interface ProposalItemFormProps {
  form: UseFormReturn<ProposalFormValues>;
}

const ProposalItemForm: React.FC<ProposalItemFormProps> = ({ form }) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const total = fields.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        Itens do Orçamento
      </h3>
      
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="p-3 border border-border rounded-lg bg-secondary/50 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium">Item {index + 1}</Label>
                <Input
                  placeholder="Nome do Serviço/Produto"
                  {...form.register(`items.${index}.name`)}
                  className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
                />
                <Textarea
                  placeholder="Descrição detalhada (opcional)"
                  {...form.register(`items.${index}.description`)}
                  className="bg-input border-border text-foreground focus-visible:ring-ring text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Quantidade</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                      className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor Unitário (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                      className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Subtotal: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(field.quantity * field.unit_price)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="h-7 w-7 text-red-500 hover:bg-red-500/10 flex-shrink-0 mt-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ name: "", description: "", quantity: 1, unit_price: 0 })}
        className="w-full border-dashed border-border text-primary hover:bg-primary/10"
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item
      </Button>

      <div className="flex justify-between items-center border-t border-border pt-4 mt-4">
        <p className="text-lg font-bold text-foreground">Total Estimado:</p>
        <p className="text-2xl font-bold text-primary">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
        </p>
      </div>
    </div>
  );
};

export default ProposalItemForm;