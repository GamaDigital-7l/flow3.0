import React from 'react';
import { Input } from '@/components/ui/input'; // Importando o Input do shadcn/ui
import { cn } from '@/lib/utils';

interface TimePickerProps {
    value: string | null;
    onChange: (time: string | null) => void;
    className?: string;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, className }) => {
    return (
        <Input 
            type="time" 
            value={value || ''} 
            onChange={(e) => onChange(e.target.value || null)} 
            className={cn(
                "w-full bg-input border-border text-foreground focus-visible:ring-ring h-10 px-3 text-sm",
                className
            )}
            // Adicionando atributos para garantir o formato 24h em alguns navegadores
            step="60" // Permite selecionar minutos
        />
    );
};

export default TimePicker;