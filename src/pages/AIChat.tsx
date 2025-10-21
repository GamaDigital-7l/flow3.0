"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send, Loader2, Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AIChat: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === "" || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [...messages, userMessage] },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      const aiResponse: Message = { role: "assistant", content: data.response };
      setMessages((prevMessages) => [...prevMessages, aiResponse]);
    } catch (err: any) {
      showError("Erro ao se comunicar com a IA: " + err.message);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", content: "Desculpe, não consegui processar sua solicitação no momento." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <MessageSquare className="h-7 w-7 text-primary flex-shrink-0" /> Assistente de IA
      </h1>
      <p className="text-lg text-muted-foreground">
        Converse com seu assistente de IA para obter ajuda e insights.
      </p>

      <Card className="flex flex-col flex-grow bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground text-xl md:text-2xl">Chat com IA</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow p-4 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground text-base md:text-lg">
              Olá! Como posso te ajudar hoje?
            </p>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <Bot className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              )}
              <div
                className={`max-w-[80%] sm:max-w-[70%] p-3 rounded-lg break-words ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <p className="text-sm md:text-base">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <User className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-1" />
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3 justify-start">
              <Bot className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div className="max-w-[80%] sm:max-w-[70%] p-3 rounded-lg bg-secondary text-secondary-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <div className="p-4 border-t border-border flex items-center gap-2 flex-wrap">
          <Input
            type="text"
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring min-w-[150px] text-sm md:text-base"
            disabled={isLoading}
          />
          <Button onClick={handleSendMessage} disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Enviar</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AIChat;