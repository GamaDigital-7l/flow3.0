"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookOpen, Edit, Trash2, Target } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import BookForm from "@/components/BookForm";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

interface Book {
  id: string;
  title: string;
  author?: string;
  description?: string;
  read_status: "unread" | "reading" | "finished";
  created_at: string;
  updated_at: string;
  total_pages?: number;
  current_page?: number;
  daily_reading_target_pages?: number;
  last_read_date?: string;
}

const fetchBooks = async (userId: string): Promise<Book[]> => {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Books: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: books, isLoading, error, refetch } = useQuery<Book[], Error>({
    queryKey: ["books", userId],
    queryFn: () => fetchBooks(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingBook, setEditingBook] = React.useState<Book | undefined>(undefined);
  const [currentPageInput, setCurrentPageInput] = React.useState<{ [key: string]: number }>({});

  React.useEffect(() => {
    if (books) {
      const initialPageInputs: { [key: string]: number } = {};
      books.forEach(book => {
        initialPageInputs[book.id] = book.current_page || 0;
      });
      setCurrentPageInput(initialPageInputs);
    }
  }, [books]);

  const updateBookPageMutation = useMutation({
    mutationFn: async ({ bookId, newPage }: { bookId: string; newPage: number }) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error: updateError } = await supabase
        .from("books")
        .update({ 
          current_page: newPage, 
          last_read_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString() 
        })
        .eq("id", bookId)
        .eq("user_id", userId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books", userId] });
      showSuccess("Página atualizada com sucesso!");
    },
    onError: (err: any) => {
      showError("Erro ao atualizar página: " + err.message);
      console.error("Erro ao atualizar página:", err);
    },
  });

  const handleDeleteBook = useMutation({
    mutationFn: async (bookId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error: deleteError } = await supabase
        .from("books")
        .delete()
        .eq("id", bookId)
        .eq("user_id", userId);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books", userId] });
      showSuccess("Livro deletado com sucesso!");
    },
    onError: (err: any) => {
      showError("Erro ao deletar livro: " + err.message);
      console.error("Erro ao deletar livro:", err);
    },
  });

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setIsFormOpen(true);
  };

  const handleUpdatePage = (bookId: string) => {
    const newPage = currentPageInput[bookId];
    if (newPage !== undefined && !isNaN(newPage)) {
      updateBookPageMutation.mutate({ bookId, newPage });
    } else {
      showError("Por favor, insira um número de página válido.");
    }
  };

  if (!userId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold text-foreground">Sua Biblioteca de Livros</h1>
        <p className="text-lg text-muted-foreground">Faça login para ver seus livros.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold text-foreground">Sua Biblioteca de Livros</h1>
        <p className="text-lg text-muted-foreground">Carregando seus livros...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar livros: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold text-foreground">Sua Biblioteca de Livros</h1>
        <p className="text-lg text-red-500">Erro ao carregar livros: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground">Sua Biblioteca de Livros</h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingBook(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingBook(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Livro
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingBook ? "Editar Livro" : "Adicionar Novo Livro"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingBook ? "Atualize os detalhes do seu livro." : "Adicione um novo livro à sua biblioteca."}
              </DialogDescription>
            </DialogHeader>
            <BookForm
              initialData={editingBook}
              onBookAdded={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Explore e gerencie seus livros favoritos.
      </p>

      {books && books.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map((book) => (
            <Card key={book.id} className="flex flex-col overflow-hidden h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
              <Link to={`/books/${book.id}`} className="block">
                <img
                  src={book.cover_image_url || "/placeholder.svg"}
                  alt={book.title}
                  className="w-full h-48 object-cover"
                />
              </Link>
              <CardHeader>
                <CardTitle className="text-lg line-clamp-2 text-foreground break-words">{book.title}</CardTitle>
                <CardDescription className="line-clamp-1 text-muted-foreground break-words">{book.author}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between">
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                      ${book.read_status === "reading" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""}
                      ${book.read_status === "unread" ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" : ""}
                      ${book.read_status === "finished" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}
                    `}
                  >
                    {book.read_status === "reading" && "Lendo"}
                    {book.read_status === "unread" && "Não Lido"}
                    {book.read_status === "finished" && "Concluído"}
                  </span>
                  {book.total_pages && (
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                      <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                      Páginas: {book.current_page || 0} / {book.total_pages}
                    </p>
                  )}
                  {book.daily_reading_target_pages && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Target className="h-4 w-4 text-primary flex-shrink-0" />
                      Meta Diária: {book.daily_reading_target_pages} páginas
                    </p>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {book.total_pages && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Label htmlFor={`current-page-${book.id}`} className="sr-only">Página Atual</Label>
                      <Input
                        id={`current-page-${book.id}`}
                        type="number"
                        min="0"
                        max={book.total_pages}
                        value={currentPageInput[book.id] ?? 0} 
                        onChange={(e) => setCurrentPageInput({ ...currentPageInput, [book.id]: parseInt(e.target.value) })}
                        className="w-full sm:w-24 bg-input border-border text-foreground focus-visible:ring-ring"
                      />
                      <Button
                        onClick={() => handleUpdatePage(book.id)}
                        size="sm"
                        className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={updateBookPageMutation.isPending}
                      >
                        Atualizar
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleEditBook(book)} className="text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar Livro</span>
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDeleteBook.mutate(book.id)} className="text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Deletar Livro</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhum livro encontrado. Adicione um novo livro para começar!</p>
      )}

      <div className="flex-1 flex items-end justify-center">
      </div>
    </div>
  );
};

export default Books;