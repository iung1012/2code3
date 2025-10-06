"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Sparkles, User, Bot } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ModificationChatProps {
  currentFiles: Record<string, string>
  onModify: (prompt: string) => Promise<void>
  isModifying: boolean
  initialPrompt?: string
  aiResponse?: string
}

export function ModificationChat({ currentFiles, onModify, isModifying, initialPrompt, aiResponse }: ModificationChatProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const initialMessages: Message[] = []
    
    // Add initial prompt as first message if provided
    if (initialPrompt) {
      initialMessages.push({
        role: "user",
        content: `📝 Prompt inicial: "${initialPrompt}"`,
        timestamp: new Date(),
      })
    }
    
    // Add AI response if provided
    if (aiResponse) {
      initialMessages.push({
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      })
    }
    
    // Add welcome message
    initialMessages.push({
      role: "assistant",
      content: "Olá! Posso ajudar a modificar seu website. Descreva o que você gostaria de mudar.",
      timestamp: new Date(),
    })
    
    return initialMessages
  })
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isModifying])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isModifying) return

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    const selectedModel = localStorage.getItem("openrouter_model") || "google/gemini-2.0-flash-exp:free"
    console.log("[v0] Modification using model:", selectedModel)

    try {
      await onModify(input.trim())

      const assistantMessage: Message = {
        role: "assistant",
        content: "Modificação aplicada com sucesso! O preview foi atualizado.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content:
          "Desculpe, ocorreu um erro ao aplicar a modificação. Por favor, tente novamente com um prompt mais específico.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-xl border-l border-border/40">
      {/* Header */}
      <div className="p-4 border-b border-border/40 bg-card/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Chat de Modificações</h3>
            <p className="text-xs text-muted-foreground">Peça mudanças no seu website</p>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <span className="text-xs opacity-60 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
          ))}
          {isModifying && (
            <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Aplicando modificações...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border/40 bg-card/50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Mude a cor do botão para azul..."
            className="min-h-[60px] max-h-[120px] resize-none bg-background/50 border-border/40 focus:border-primary/40 rounded-2xl"
            disabled={isModifying}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isModifying}
            className="h-[60px] w-[60px] rounded-2xl flex-shrink-0"
          >
            {isModifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Pressione Enter para enviar, Shift+Enter para nova linha</p>
      </form>
    </div>
  )
}
