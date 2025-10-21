"use client";

import React from "react";
import { Note } from "@/pages/Notes";
import { Button } from "@/components/ui/button";
import { Edit, Pin, PinOff, Tag as TagIcon, ListTodo, TextCursorInput, CheckCircle2, Archive, Trash2 } from "lucide-react";
import { format } from "date-fns/format";
import { ptBR } from "date-fns/locale/pt-BR";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NoteViewerProps {
  note: Note;
  onEdit: (note: Note) => void;
}

const NoteViewer: React.FC<NoteViewerProps> = ({ note, onEdit }) => {
  const renderNoteContent = () => {
    if (note.type === "checklist") {
      try {
        const checklistItems = JSON.parse(note.content);
        if (!Array.isArray(checklistItems)) return <p className="text-xs text-red-500">Conteúdo da checklist inválido.</p>;
        return (
          <ul className="space-y-1 text-sm md:text-base text-foreground">
            {checklistItems.map((item: { text: string; completed: boolean }, index: number) => (
              <li key={index} className="flex items-center gap-2">
                <span className={cn(item.completed ? "line-through text-muted-foreground" : "", "break-words")}>
                  {item.text}
                </span>
                {item.completed && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
              </li>
            ))}
          </ul>
        );
      } catch (e) {
        return <p className="text-xs text-red-500">Erro ao carregar checklist.</p>;
      }
    }
    return <div className="prose dark:prose-invert max-w-none text-xs md:text-sm text-foreground break-words" dangerouslySetInnerHTML={{ __html: note.content }} />;
  };

  return (
    <div className="p-3 space-y-3 bg-card rounded-xl frosted-glass card-hover-effect">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{note.title || "Nota Sem Título"}</h2>
        <Button variant="ghost" size="icon" onClick={() => onEdit(note)} className="text-blue-500 hover:bg-blue-500/10 h-8 w-8">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Editar Nota</span>
        </Button>
      </div>

      <div className="space-y-2">
        {renderNoteContent()}
      </div>

      {(note.tags && note.tags.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {note.tags.map((tag) => (
            <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {note.pinned && <Badge variant="secondary" className="bg-primary/20 text-primary flex items-center gap-1 h-5 px-1.5"><Pin className="h-3 w-3" /> Fixada</Badge>}
        {note.archived && <Badge variant="secondary" className="bg-muted/20 text-muted-foreground flex items-center gap-1 h-5 px-1.5"><Archive className="h-3 w-3" /> Arquivada</Badge>}
        {note.trashed && <Badge variant="destructive" className="bg-red-500/20 text-red-500 flex items-center gap-1 h-5 px-1.5"><Trash2 className="h-3 w-3" /> Lixeira</Badge>}
      </div>
    </div>
  );
};

export default NoteViewer;