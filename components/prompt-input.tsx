"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles } from "lucide-react"

interface PromptInputProps {
  onGenerate: (prompt: string) => void
}

export function PromptInput({ onGenerate }: PromptInputProps) {
  const [prompt, setPrompt] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      onGenerate(prompt)
    }
  }

  const examples = [
    "Landing page para produto SaaS com preços",
    "App de tarefas com categorias e tema escuro",
    "Blog com posts e sistema de busca",
    "Portfólio com galeria de projetos",
    "Catálogo de produtos com carrinho",
  ]

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative group">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva o site que você quer criar... (ex: 'Um app de tarefas com categorias e tema escuro')"
            className="min-h-28 text-lg bg-card/30 backdrop-blur-xl border-border/40 focus:border-primary/50 focus:bg-card/50 resize-none pr-32 leading-relaxed transition-all rounded-3xl px-6 py-4 font-light"
          />
          <Button
            type="submit"
            size="lg"
            disabled={!prompt.trim()}
            className="absolute bottom-4 right-4 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all disabled:opacity-40 rounded-2xl px-6"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-3 justify-center">
        {examples.map((example, i) => (
          <button
            key={i}
            onClick={() => setPrompt(example)}
            className="px-5 py-3 text-sm bg-card/30 backdrop-blur-xl hover:bg-card/50 border border-border/40 hover:border-border/60 rounded-2xl transition-all duration-200 font-light hover:shadow-sm"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )
}
