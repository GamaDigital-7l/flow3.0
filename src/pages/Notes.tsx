"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, NotebookText, Archive, Trash2, Tag as TagIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/integrations/supabase/auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NoteForm from "@/components/NoteForm";
import NoteItem from "@/components/NoteItem";
import { Tag } from "@/types/task";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import TagForm from "@/components/TagForm";
import { Badge } from "@/components/ui/badge";
import QuickNoteCreator from "@/components/QuickNoteCreator";
import NoteViewer from "@/components/NoteViewer";

// Definir o tipo para um item de checklist
interface ChecklistItem {
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title?: string | null;
  content: string; // Agora sempre string (HTML para texto, JSON string para checklist)
  type: "text" | "checklist";
  color: string; // Mantido para consistência com o DB, mas fixado em #FFFFFF
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

const fetchNotes = async (userId: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from("notes")
    .select(`
      *,
      note_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  const mappedData = data?.map((note: any) => ({
    ...note,
    tags: note.note_tags.map((nt: any) => nt.tags),
  })) || [];
  return mappedData;
};

const fetchTags = async (userId: string): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const Notes: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allNotes, isLoading, error, refetch } = useQuery<Note[], Error>({
    queryKey: ["notes", userId],
    queryFn: () => fetchNotes(userId!),
    enabled: !!userId,
  });

  const { data: availableTags, isLoading: isLoadingTags, error: tagsError, refetch: refetchTags } = useQuery<Tag[], Error>({
    queryKey: ["tags", userId],
    queryFn: () => fetchTags(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState<Note | undefined>(undefined);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [isTagFormOpen, setIsTagFormOpen] = useState(false);

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
    setIsViewerOpen(true);
  };

  const handleEditNoteFromViewer = (note: Note) => {
    setViewingNote(undefined);
    setIsViewerOpen(false);
    setEditingNote(note);
    setIsFormOpen(true);
  };

  const handleTagFilterToggle = (tagId: string) => {
    setSelectedFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCloseTagForm = () => {
    setIsTagFormOpen(false);
    refetchTags();
  };

  const filteredNotes = allNotes?.filter(note => {
    if (note.archived || note.trashed) return false;

    let contentText = "";
    if (note.type === "text") {
      contentText = note.content.replace(/<[^>]*>?/gm, '');
    } else if (note.type === "checklist") {
      try {
        const checklistItems = JSON.parse(note.content);
        if (Array.isArray(checklistItems)) {
          contentText = checklistItems.map(item => item.text).join(" ");
        }
      } catch (e) {
        // console.error("Erro ao parsear conteúdo da checklist:", e);
      }
    }

    const matchesSearch = (note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contentText.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTags = selectedFilterTagIds.length === 0 || 
                        (note.tags && note.tags.some(tag => selectedFilterTagIds.includes(tag.id)));

    return matchesSearch && matchesTags;
  }) || [];

  const pinnedActiveNotes = filteredNotes.filter(note => note.pinned);
  const unpinnedActiveNotes = filteredNotes.filter(note => !note.pinned);

  if (isLoading || isLoadingTags) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Segundo Cérebro (Notas)</h1>
        <p className="text-sm text-muted-foreground">Carregando suas notas...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar notas: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Segundo Cérebro (Notas)</h1>
        <p className="text-sm text-red-500">Erro ao carregar notas: {error.message}</p>
      </div>
    );
  }

  if (tagsError) {
    showError("Erro ao carregar rótulos: " + tagsError.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Segundo Cérebro (Notas)</h1>
        <p className="text-sm text-red-500">Erro ao carregar rótulos: {tagsError.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 sm:text-3xl">
          <NotebookText className="h-6 w-6 text-primary flex-shrink-0" /> Segundo Cérebro (Notas)
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Seu caderno digital para todas as suas ideias, pensamentos e informações importantes.
      </p>

      <QuickNoteCreator onNoteCreated={refetch} userId={userId} />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-grow min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar notas por título ou conteúdo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 bg-input border-border text-foreground focus-visible:ring-0 h-9 text-sm"
            disabled={!userId}
          />
        </div>
        <Popover open={isTagFilterOpen} onOpenChange={setIsTagFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 flex-shrink-0 h-9 px-3 text-sm"
              disabled={!userId}
            >
              <TagIcon className="h-4 w-4 flex-shrink-0" />
              {selectedFilterTagIds.length > 0 ? (
                <div className="flex flex-wrap gap-1 min-w-0">
                  {selectedFilterTagIds.map(tagId => {
                    const tag = availableTags?.find(t => t.id === tagId);
                    return tag ? (
                      <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
                        {tag.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              ) : (
                <span>Filtrar por Rótulo</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[200px] p-0 bg-popover border-border rounded-md shadow-lg">
            <Command className="bg-popover text-popover-foreground">
              <CommandInput placeholder="Buscar rótulo..." className="h-9" />
              <CommandList>
                <CommandEmpty>Nenhum rótulo encontrado.</CommandEmpty>
                <CommandGroup>
                  {availableTags?.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => handleTagFilterToggle(tag.id)}
                      className="flex items-center justify-between h-9 px-3 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
                          {tag.name}
                        </Badge>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          selectedFilterTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup className="border-t border-border">
                  <Dialog open={isTagFormOpen} onOpenChange={handleCloseTagForm}>
                    <DialogTrigger asChild>
                      <CommandItem onSelect={() => {
                        setIsTagFormOpen(true);
                        setIsTagFilterOpen(false);
                      }} className="text-primary hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Criar Novo Rótulo
                      </CommandItem>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Criar Novo Rótulo</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          Adicione um novo rótulo para organizar suas notas.
                        </DialogDescription>
                      </DialogHeader>
                      <TagForm onTagSaved={refetchTags} onClose={handleCloseTagForm} />
                    </DialogContent>
                  </Dialog>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {pinnedActiveNotes.length > 0 && (
        <>
          <h2 className="text-base font-bold text-muted-foreground mb-2">FIXADAS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {pinnedActiveNotes.map((note) => (
              <NoteItem key={note.id} note={note} refetchNotes={refetch} onViewNote={handleViewNote} />
            ))}
          </div>
        </>
      )}

      <h2 className="text-base font-bold text-muted-foreground mb-2">OUTRAS</h2>
      {unpinnedActiveNotes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {unpinnedActiveNotes.map((note) => (
            <NoteItem key={note.id} note={note} refetchNotes={refetch} onViewNote={handleViewNote} />
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma nota ativa encontrada. Adicione uma nova nota!</p>
      )}

      {/* Dialog para o NoteViewer */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
          {viewingNote && (
            <NoteViewer note={viewingNote} onEdit={handleEditNoteFromViewer} />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para o NoteForm (edição) */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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
            onNoteSaved={() => {
              refetch();
              setIsFormOpen(false);
              setEditingNote(undefined);
            }}
            onClose={() => setIsFormOpen(false)}
            userId={session?.user?.id}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Notes;