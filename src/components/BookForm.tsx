"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; 

const bookSchema = z.object({
  title: z.string().min(1, "O título do livro é obrigatório."),
  author: z.string().optional(),
  cover_image_url: z.string().url("URL da capa inválida.").optional().or(z.literal("")),
  description: z.string().optional(),
  read_status: z.enum(["unread", "reading", "finished"]).default("unread"),
  pdf_file: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.type === "application/pdf", "Apenas arquivos PDF são permitidos."),
  content: z.string().optional(), // Adicionado o campo content
  total_pages: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(1, "O total de páginas deve ser um número positivo.").nullable().optional(),
  ),
  daily_reading_target_pages: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(1, "A meta diária deve ser um número positivo.").nullable().optional(),
  ),
  pdf_url: z.string().optional().nullable(),
  current_page: z.number().optional().nullable(),
});

type BookFormValues = z.infer<typeof bookSchema>;

interface BookFormProps {
  onBookAdded: () => void;
  onClose: () => void;
  initialData?: BookFormValues & { id: string };
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

const BookForm: React.FC<BookFormProps> = ({ onBookAdded, onClose, initialData }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: initialData ? {
      ...initialData,
      pdf_file: undefined,
      content: initialData.content || "",
    } : {
      title: "",
      author: "",
      cover_image_url: "",
      description: "",
      read_status: "unread",
      pdf_file: undefined,
      content: "",
      total_pages: undefined,
      daily_reading_target_pages: undefined,
    },
  });

  const [hasPdfFileSelected, setHasPdfFileSelected] = useState(false);
  const [hasContentInEditor, setHasContentInEditor] = useState(false);

  // Initialize state based on initialData
  React.useEffect(() => {
    if (initialData) {
      setHasPdfFileSelected(!!initialData.pdf_url);
      setHasContentInEditor(!!initialData.content && initialData.content.trim() !== "" && initialData.content !== "<p><br></p>");
    }
  }, [initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("pdf_file", file);
      setHasPdfFileSelected(true);
      form.setValue("content", ""); // Clear content if PDF is selected
      setHasContentInEditor(false);
    } else {
      form.setValue("pdf_file", undefined);
      setHasPdfFileSelected(false);
    }
  };

  const handleContentChange = (value: string) => {
    form.setValue("content", value, { shouldDirty: true });
    const hasText = value.trim() !== "" && value !== "<p><br></p>";
    setHasContentInEditor(hasText);
    if (hasText) {
      form.setValue("pdf_file", undefined); // Clear PDF file if content is entered
      setHasPdfFileSelected(false);
    }
  };

  const onSubmit = async (values: BookFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let pdfUrl: string | null = initialData?.pdf_url || null;
      let bookContent: string | null = values.content || null;

      // Prioritize PDF if a new file is uploaded
      if (values.pdf_file) {
        const file = values.pdf_file;
        const sanitizedFilename = sanitizeFilename(file.name);
        const filePath = `public/${Date.now()}-${sanitizedFilename}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("book-pdfs")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Erro ao fazer upload do PDF: " + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("book-pdfs")
          .getPublicUrl(filePath);
        
        pdfUrl = publicUrlData.publicUrl;
        bookContent = null; // Clear content if PDF is uploaded
      } else if (bookContent && bookContent.trim() !== "" && bookContent !== "<p><br></p>") {
        pdfUrl = null; // Clear PDF URL if content is present
      } else {
        bookContent = null; // Ensure content is null if empty
        // If no new PDF and no content, keep existing PDF URL if any
        if (!hasPdfFileSelected && !initialData?.pdf_url) {
            pdfUrl = null; // If no PDF was ever selected/uploaded, ensure it's null
        }
      }

      const dataToSave = {
        title: values.title,
        author: values.author || null,
        cover_image_url: values.cover_image_url || null,
        description: values.description || null,
        pdf_url: pdfUrl,
        content: bookContent, // Salvar o conteúdo
        read_status: values.read_status,
        total_pages: values.total_pages || null,
        daily_reading_target_pages: values.daily_reading_target_pages || null,
        current_page: initialData?.current_page || 0, // Manter a página atual ou 0
        user_id: userId,
      };

      if (initialData) {
        const { error: updateError } = await supabase.from("books").update(dataToSave).eq("id", initialData.id);
        if (updateError) throw updateError;
        showSuccess("Livro atualizado com sucesso!");
      } else {
        const { error: insertError } = await supabase.from("books").insert(dataToSave);
        if (insertError) throw insertError;
        showSuccess("Livro adicionado com sucesso!");
      }
      
      form.reset();
      onBookAdded();
      onClose();
    } catch (error: any) {
      showError("Erro ao adicionar livro: " + error.message);
      console.error("Erro ao adicionar livro:", error);
    }
  };

  const modules = React.useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link'], // Removido 'image' para simplificar, já que temos PDF
      ['clean']
    ],
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link'
  ];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: O Senhor dos Anéis"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="author" className="text-foreground">Autor (Opcional)</Label>
        <Input
          id="author"
          {...form.register("author")}
          placeholder="Ex: J.R.R. Tolkien"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="cover_image_url" className="text-foreground">URL da Imagem de Capa (Opcional)</Label>
        <Input
          id="cover_image_url"
          {...form.register("cover_image_url")}
          placeholder="Ex: https://exemplo.com/capa.jpg"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.cover_image_url && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.cover_image_url.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Uma breve descrição do livro..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="total_pages" className="text-foreground">Total de Páginas (Opcional)</Label>
        <Input
          id="total_pages"
          type="number"
          {...form.register("total_pages", { valueAsNumber: true })}
          placeholder="Ex: 500"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.total_pages && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.total_pages.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="daily_reading_target_pages" className="text-foreground">Meta Diária de Leitura (Páginas, Opcional)</Label>
        <Input
          id="daily_reading_target_pages"
          type="number"
          {...form.register("daily_reading_target_pages", { valueAsNumber: true })}
          placeholder="Ex: 10"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.daily_reading_target_pages && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.daily_reading_target_pages.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="pdf_file" className="text-foreground">Arquivo PDF (Opcional)</Label>
        <Input
          id="pdf_file"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
          disabled={hasContentInEditor} // Disable if content is being edited
        />
        {form.formState.errors.pdf_file && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.pdf_file.message}
          </p>
        )}
        {hasPdfFileSelected && <p className="text-xs text-muted-foreground mt-1">PDF selecionado. O conteúdo de texto será ignorado.</p>}
      </div>
      <div>
        <Label htmlFor="content" className="text-foreground">Conteúdo do Livro (Opcional)</Label>
        <ReactQuill
          theme="snow"
          value={form.watch("content")}
          onChange={handleContentChange}
          modules={modules}
          formats={formats}
          placeholder="Escreva o conteúdo do livro aqui..."
          className="bg-transparent text-foreground"
          readOnly={hasPdfFileSelected} // Disable if PDF is selected
        />
        {form.formState.errors.content && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.content.message}
          </p>
        )}
        {hasContentInEditor && <p className="text-xs text-muted-foreground mt-1">Conteúdo de texto adicionado. O arquivo PDF será ignorado.</p>}
      </div>
      <div>
        <Label htmlFor="read_status" className="text-foreground">Status de Leitura</Label>
        <Select
          onValueChange={(value: "unread" | "reading" | "finished") =>
            form.setValue("read_status", value)
          }
          value={form.watch("read_status")}
        >
          <SelectTrigger id="read_status" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="unread">Não Lido</SelectItem>
            <SelectItem value="reading">Lendo</SelectItem>
            <SelectItem value="finished">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Adicionar Livro</Button>
    </form>
  );
};

export default BookForm;