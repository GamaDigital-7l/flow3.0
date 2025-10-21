import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Target } from "lucide-react";
import { Client } from "@/types/client";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  progress: { goal: number; completed: number; percentage: number };
}

const ClientCard: React.FC<ClientCardProps> = ({ client, onEdit, onDelete, progress }) => {
  const isGoalMet = progress.completed >= progress.goal && progress.goal > 0;

  return (
    <Card className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={client.logo_url || undefined} alt={client.name} />
            <AvatarFallback>{client.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-base font-semibold text-foreground break-words min-w-0 line-clamp-1">{client.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0">
          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(client); }} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Cliente</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(client.id); }} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Cliente</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between p-3 pt-0">
        {client.description && (
          <CardDescription className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">{client.description}</CardDescription>
        )}
        
        {progress.goal > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3 text-primary" /> Meta: {progress.goal} entregas
              </p>
              <p className={cn("text-xs font-semibold", isGoalMet ? "text-green-500" : "text-foreground")}>
                {progress.completed}/{progress.goal}
              </p>
            </div>
            <Progress value={progress.percentage} className="h-1.5" indicatorClassName={isGoalMet ? "bg-green-500" : "bg-primary"} />
            <p className="text-xs text-muted-foreground text-right">{progress.percentage.toFixed(0)}% concluído</p>
          </div>
        )}
        {progress.goal === 0 && (
          <p className="text-xs text-muted-foreground mt-2">Meta mensal não definida.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientCard;