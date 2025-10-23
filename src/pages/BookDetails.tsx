"use client";

import React, { useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ptBR } from "date-fns/locale/pt-BR";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime } from "@/lib/utils"; // Importando as novas funções

interface Book {
  id: string;
  title: string;
  author?: string;
  description?: string;
  content?: string;
  cover_image_url?: string;
  pdf_url?: string;
  created_at: string;
}

const fetchBookById = async (bookId: string): Promise<Book | null> => {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, description, content, cover_image_url, pdf_url, created_at")
    .eq("id", bookId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const BookDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const touchStartX = useRef(0);

  const { data: book, isLoading, error } = useQuery<Book | null, Error>({
    queryKey: ["book", id],
    queryFn: () => fetchBookById(id!),
    enabled: !!id,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const touchEndX = e.changedTouches[0].clientX;
    const swipeDistance = touchEndX - touchStartX.current;
    const swipeThreshold = 50; // Pixels to consider a swipe

    if (swipeDistance > swipeThreshold) {
      navigate(-1); // Swipe right to go back
    }
  };

  if (!id) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Livro Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O ID do livro não foi fornecido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Livro...</h1>
        <p className="text-lg text-muted-foreground">Preparando os detalhes do livro.</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar livro: " + error.message);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Erro ao Carregar Livro</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
        <Button onClick={() => navigate(`/books/${id}`)} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Detalhes do Livro
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Livro Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O livro que você está procurando não existe ou foi removido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => navigate("/books")} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-4xl font-bold break-words">{book.title}</h1>
          {book.author && <p className="text-lg md:text-xl text-muted-foreground break-words">Por {book.author}</p>}
        </div>
      </div>

      <Card className="bg-card border border-border rounded-xl shadow-sm card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground text-xl md:text-2xl">Detalhes do Livro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          {book.cover_image_url && (
            <img src={book.cover_image_url} alt={book.title} className="w-48 h-auto rounded-md object-cover mx-auto" />
          )}
          {book.description && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground">Descrição:</h3>
              <p className="text-muted-foreground break-words text-base md:text-lg">{book.description}</p>
            </div>
          )}

          {book.pdf_url && (
            <Link to={`/books/${book.id}/read`}>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-base md:text-lg">
                <BookOpen className="mr-2 h-4 w-4" /> Ler PDF em Tela Cheia
              </Button>
            </Link>
          )}

          {book.content && !book.pdf_url && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground">Conteúdo:</h3>
              <div className="prose dark:prose-invert max-w-none text-foreground break-words text-base md:text-lg">
                <div dangerouslySetInnerHTML={{ __html: book.content.replace(/\n/g, '<br />') }} />
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground pt-2 border-t">Criado em: {formatDateTime(book.created_at, false)}</p>
          {!book.pdf_url && !book.content && (
            <p className="text-muted-foreground text-base md:text-lg">Nenhum conteúdo de livro ou PDF disponível para leitura.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookDetails;