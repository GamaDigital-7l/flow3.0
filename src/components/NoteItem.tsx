import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Pin, PinOff, Archive, ArchiveRestore, Trash2, Edit, Undo2, MoreVertical, Bell } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Note } from "@/pages/Notes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import NoteForm from "./NoteForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

interface NoteItemProps {
  note: Note;
  refetchNotes: () => void;
  onViewNote: (note: Note) => void;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, refetchNotes, onViewNote }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<Note | undefined>(undefined);

  const updateNoteMutation = useMutation({
    mutationFn: async (updatedFields: Partial<Note>) => {
      if (!session?.user?.id) {
        showError("Usuário não autenticado.");
        return;
      }
      const { error } = await supabase
        .from("notes")
        .update({ ...updatedFields, updated_at: new Date().toISOString() })
        .eq("id", note.id)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      showSuccess("Nota atualizada com sucesso!");
    },
    onError: (err: any) => {
      showError("Erro ao atualizar nota: " + err.message);
      console.error("Erro ao atualizar nota:", err);
    },
  });

  const handleDeletePermanently = useMutation({
    mutationFn: async (noteId: string) => {
      if (!session?.user?.id) {
        showError("Usuário não autenticado.");
        return;
      }
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      showSuccess("Nota excluída permanentemente!");
    },
    onError: (err: any) => {
      showError("Erro ao excluir nota permanentemente: " + err.message);
      console.error("Erro ao excluir nota permanentemente:", err);
    },
  });

  const handleEditNote = (noteToEdit: Note) => {
    setEditingNote(noteToEdit);
    setIsFormOpen(true);
  };

  const handlePinToggle = () => {
    updateNoteMutation.mutate({ pinned: !note.pinned });
  };

  const handleArchiveToggle = () => {
    updateNoteMutation.mutate({ archived: !note.archived, pinned: false });
  };

  const handleTrashToggle = () => {
    updateNoteMutation.mutate({ trashed: !note.trashed, pinned: false, archived: false });
  };

  const handleRestoreFromTrash = () => {
    updateNoteMutation.mutate({ trashed: false, archived: false, pinned: false });
  };

  const handleChecklistItemToggle = async (index: number, checked: boolean) => {
    if (note.type !== "checklist") return;

    try {
      const currentContent = JSON.parse(note.content);
      if (Array.isArray(currentContent) && currentContent[index]) {
        currentContent[index].completed = checked;
        await updateNoteMutation.mutateAsync({ content: JSON.stringify(currentContent) });
      }
    } catch (err) {
      showError("Erro ao atualizar item da checklist.");
    }
  };

  const renderNoteContentPreview = () => {
    if (note.type === "checklist") {
      try {
        const checklistItems = JSON.parse(note.content);
        if (!Array.isArray(checklistItems)) return <p className="text-xs text-red-500">Conteúdo da checklist inválido.</p>;
        const completedCount = checklistItems.filter(item => item.completed).length;
        const totalCount = checklistItems.length;
        return (
          <p className="text-xs md:text-sm text-muted-foreground">
            Checklist: {completedCount}/{totalCount} itens
          </p>
        );
      } catch (e) {
        return <p className="text-xs text-red-500">Erro ao carregar checklist.</p>;
      }
    }
    const plainTextContent = String(note.content).replace(/<[^>]*>?/gm, '');
    return <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">{plainTextContent}</p>;
  };

  return (
    <Card className="relative flex flex-col h-full rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 group bg-card">
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 z-10">
        {note.trashed ? (
          <>
            <Button variant="ghost" size="icon" onClick={handleRestoreFromTrash} className="h-6 w-6 text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              <Undo2 className="h-3.5 w-3.5" />
              <span className="sr-only">Restaurar</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDeletePermanently.mutate(note.id)} className="h-6 w-6 text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-red-800">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Excluir Permanentemente</span>
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" onClick={handlePinToggle} className="h-6 w-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              <span className="sr-only">{note.pinned ? "Desafixar" : "Fixar"}</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleArchiveToggle} className="h-6 w-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {note.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              <span className="sr-only">{note.archived ? "Desarquivar" : "Arquivar"}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Mais Ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border rounded-md shadow-lg text-sm">
                <DropdownMenuItem onClick={() => handleEditNote(note)} className="cursor-pointer py-1.5 px-2">
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleTrashToggle} className="text-red-600 cursor-pointer py-1.5 px-2">
                  <Trash2 className="mr-2 h-4 w-4" /> Mover para Lixeira
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      <CardHeader className="pb-1 pt-2 px-3 cursor-pointer" onClick={() => onViewNote(note)}>
        {note.title && <CardTitle className="text-sm md:text-base font-semibold break-words line-clamp-1">{note.title}</CardTitle>}
      </CardHeader>
      <CardContent className="flex-grow cursor-pointer p-3 pt-0">
        {renderNoteContentPreview()}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {note.tags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        {note.reminder_date && note.reminder_time && (
          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
            <Bell className="h-3 w-3 text-blue-500 flex-shrink-0" /> Lembrete: {note.reminder_date ? format(new Date(note.reminder_date), "PPP", { locale: ptBR }) : ''} às {note.reminder_time}
          </p>
        )}
      </CardContent>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingNote(undefined);
          }}
        >
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingNote?.title ? "Editar Nota" : "Criar Nova Nota"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingNote?.title ? "Atualize o conteúdo da sua nota." : "Escreva uma nova nota para o seu segundo cérebro."}
              </DialogDescription>
            </DialogHeader>
            <NoteForm
              initialData={editingNote}
              onNoteSaved={refetchNotes}
              onClose={() => setIsFormOpen(false)}
              userId={session?.user?.id}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default NoteItem;