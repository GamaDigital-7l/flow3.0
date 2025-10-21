import { AddClientDialog } from "./AddClientDialog";

export function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-2xl font-bold tracking-tight">
          Você ainda não tem clientes
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Comece a organizar seu funil adicionando seu primeiro cliente.
        </p>
        <AddClientDialog />
      </div>
    </div>
  );
}