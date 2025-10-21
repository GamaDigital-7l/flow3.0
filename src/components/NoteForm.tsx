"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Note } from "@/pages/Notes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlusCircle, XCircle, Tag as TagIcon, ListTodo, TextCursorInput, Pin, PinOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import TagSelector from "./TagSelector";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; 
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const checklistItemSchema = z.object({
  text: z.string().min(1, "O item da checklist não pode ser vazio."),
  completed: z.boolean().default(false),
});

const noteSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "O conteúdo da nota é obrigatório."), 
  type: z.enum(["text", "checklist"]).default("text"),
  selected_tag_ids: z.array(z.string()).optional(),
  pinned: z.boolean().default(false),
});

export type NoteFormValues = z.infer<typeof noteSchema>;

interface NoteFormProps {
  initialData?: Partial<Note> & { id?: string }; 
  onNoteSaved: () => void;
  onClose: () => void;
  userId: string | undefined; 
}

const sanitizeFilename = (filename: string) => {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
};

const NoteForm: React.FC<NoteFormProps> = ({ initialData, onNoteSaved, onClose, userId }) => { 
  const quillRef = useRef<ReactQuill>(null);

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: initialData ? {
      ...initialData,
      content: initialData.content || "", 
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
      pinned: initialData.pinned,
    } : {
      title: "",
      content: "",
      type: "text",
      selected_tag_ids: [],
      pinned: false,
    },
  });

  const noteType = form.watch("type");
  const [checklistItems, setChecklistItems] = useState<{ text: string; completed: boolean }[]>([]);
  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const isPinned = form.watch("pinned");

  useEffect(() => {
    if (noteType === "checklist" && initialData?.type === "checklist") {
      try {
        setChecklistItems(JSON.parse(initialData.content || "[]") as { text: string; completed: boolean }[]);
      } catch (e) {
        setChecklistItems([]);
      }
    } else if (noteType === "text") {
      setChecklistItems([]);
    }
  }, [noteType, initialData]);

  const addChecklistItem = () => {
    setChecklistItems(prev => [...prev, { text: "", completed: false }]);
  };

  const updateChecklistItem = (index: number, newText: string) => {
    setChecklistItems(prev => prev.map((item, i) => i === index ? { ...item, text: newText } : item));
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  const handlePinToggle = () => {
    form.setValue("pinned", !isPinned, { shouldDirty: true });
  };

  const imageHandler = useCallback(() => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para fazer upload de imagens.");
      return;
    }

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const quill = quillRef.current?.getEditor();
        if (!quill) return;

        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', '/placeholder.svg'); 
        quill.setSelection(range.index + 1, 0); 

        try {
          const sanitizedFilename = sanitizeFilename(file.name);
          const filePath = `note_images/${userId}/${Date.now()}-${sanitizedFilename}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("note-assets")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);
          }

          const { data: publicUrlData } = supabase.storage
            .from("note-assets")
            .getPublicUrl(filePath);
          
          const imageUrl = publicUrlData.publicUrl;

          quill.deleteText(range.index, 1);
          quill.insertEmbed(range.index, 'image', imageUrl); // Corrigido para range.index
          showSuccess("Imagem adicionada com sucesso!");

        } catch (err: any) {
          showError("Erro ao adicionar imagem: " + err.message);
          quill.deleteText(range.index, 1);
        }
      }
    };
  }, [userId]);

  const modules = React.useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image'], 
        ['clean']
      ],
      handlers: {
        'image': imageHandler, 
      }
    },
  }), [imageHandler]);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image' 
  ];

  const onSubmit = async (values: NoteFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    let finalContent: string;

    if (noteType === "checklist") {
      const filteredItems = checklistItems.filter(item => item.text.trim() !== "");
      if (filteredItems.length === 0) {
        showError("A checklist deve ter pelo menos um item.");
        return;
      }
      finalContent = JSON.stringify(filteredItems);
    } else {
      if (values.content.trim() === "" || values.content === "<p><br></p>") {
        showError("O conteúdo da nota não pode estar vazio.");
        return;
      }
      finalContent = values.content;
    }

    try {
      let noteId: string;

      const dataToSave = {
        title: values.title?.trim() === "" ? null : values.title,
        content: finalContent,
        color: "#FFFFFF", 
        type: values.type,
        pinned: values.pinned,
        archived: false, 
        trashed: false, 
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) { 
        const { data, error } = await supabase
          .from("notes")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        noteId = data.id;
        showSuccess("Nota atualizada com sucesso!");
      } else { 
        const { data, error } = await supabase.from("notes").insert({
          ...dataToSave,
          user_id: userId,
        }).select("id").single();

        if (error) throw error;
        noteId = data.id;
        showSuccess("Nota adicionada com sucesso!");
      }

      await supabase.from("note_tags").delete().eq("note_id", noteId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const noteTagsToInsert = values.selected_tag_ids.map(tagId => ({
          note_id: noteId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("note_tags").insert(noteTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      form.reset();
      onNoteSaved();
      onClose();
    } catch (err: any) {
      showError("Erro ao salvar nota: " + err.message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0 p-0 bg-card rounded-lg shadow-lg">
      <div className="relative p-3 bg-card"> {/* Reduzido padding */}
        <Input
          id="note-title"
          {...form.register("title")}
          placeholder="Título"
          className="w-full bg-transparent border-none text-foreground text-base font-semibold focus-visible:ring-0 px-0 mb-1.5 h-9" // Ajustado tamanho da fonte, mb e altura
          disabled={!userId}
        />

        {noteType === "text" ? (
          <ReactQuill
            key={noteType}
            ref={quillRef}
            theme="snow"
            value={form.watch("content")}
            onChange={(value) => form.setValue("content", value, { shouldDirty: true })}
            modules={modules}
            formats={formats}
            placeholder="Criar uma nota..."
            readOnly={!userId}
            className="bg-transparent text-foreground"
          />
        ) : (
          <div className="space-y-1.5"> {/* Reduzido space-y */}
            {checklistItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => {
                    setChecklistItems(prev => prev.map((i, idx) => idx === index ? { ...i, completed: checked as boolean } : i));
                  }}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 h-4 w-4" // Ajustado tamanho
                  disabled={!userId}
                />
                <Input
                  value={item.text}
                  onChange={(e) => updateChecklistItem(index, e.target.value)}
                  placeholder={`Item ${index + 1}`}
                  className="flex-grow bg-transparent border-none text-foreground focus-visible:ring-0 px-0 break-words h-9 text-sm" // Ajustado altura e tamanho da fonte
                  disabled={!userId}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeChecklistItem(index)}
                  className="text-red-500 hover:bg-red-500/10 flex-shrink-0 h-7 w-7" // Ajustado altura e largura
                  disabled={!userId}
                >
                  <XCircle className="h-4 w-4" /> {/* Ajustado tamanho do ícone */}
                  <span className="sr-only">Remover Item</span>
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={addChecklistItem} className="w-full justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm" disabled={!userId}> {/* Ajustado altura e padding */}
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item {/* Ajustado tamanho do ícone */}
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePinToggle}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground h-8 w-8" // Ajustado top, right, altura e largura
          disabled={!userId}
        >
          {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />} {/* Ajustado tamanho do ícone */}
          <span className="sr-only">{isPinned ? "Desafixar" : "Fixar"}</span>
        </Button>
      </div>

      <div className="flex items-center justify-between p-2 border-t border-border bg-card flex-wrap gap-2"> {/* Reduzido padding e gap */}
        <div className="flex items-center gap-1 flex-wrap"> {/* Reduzido gap */}
          {/* REMOVED: Popover for Reminder */}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 w-8" disabled={!userId}> {/* Ajustado altura e largura */}
                <TagIcon className="h-4 w-4" /> {/* Ajustado tamanho do ícone */}
                <span className="sr-only">Adicionar Rótulo</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[200px] p-0 bg-popover border-border rounded-md shadow-lg">
              <TagSelector
                selectedTagIds={selectedTagIds}
                onTagSelectionChange={handleTagSelectionChange}
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={() => form.setValue("type", noteType === "text" ? "checklist" : "text")} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 w-8" disabled={!userId}> {/* Ajustado altura e largura */}
            {noteType === "text" ? <ListTodo className="h-4 w-4" /> : <TextCursorInput className="h-4 w-4" />} {/* Ajustado tamanho do ícone */}
            <span className="sr-only">{noteType === "text" ? "Mudar para Checklist" : "Mudar para Texto"}</span>
          </Button>
        </div>

        <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 text-sm" disabled={!userId}> {/* Ajustado altura e padding */}
          Salvar e Fechar
        </Button>
      </div>
    </form>
  );
};

export default NoteForm;