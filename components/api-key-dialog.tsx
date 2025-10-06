"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Key } from "lucide-react"

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AVAILABLE_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (Premium)", category: "Premium" },
  { id: "deepseek/deepseek-chat-v3.1:free", name: "DeepSeek Chat v3.1 (Free)", category: "Free" },
  { id: "z-ai/glm-4.5-air:free", name: "GLM 4.5 Air (Free)", category: "Free" },
  { id: "qwen/qwen3-coder:free", name: "Qwen3 Coder (Free)", category: "Free" },
  { id: "moonshotai/kimi-k2:free", name: "Kimi K2 (Free)", category: "Free" },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)", category: "Free" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)", category: "Free" },
  { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)", category: "Free" },
]

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState("anthropic/claude-3.5-sonnet")

  useEffect(() => {
    const stored = localStorage.getItem("openrouter_api_key")
    if (stored) {
      setApiKey(stored)
      setHasKey(true)
    }
    const storedModel = localStorage.getItem("openrouter_model")
    if (storedModel) {
      setSelectedModel(storedModel)
    }
  }, [open])

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem("openrouter_api_key", apiKey.trim())
      localStorage.setItem("openrouter_model", selectedModel)
      setHasKey(true)
      onOpenChange(false)
    }
  }

  const handleRemove = () => {
    localStorage.removeItem("openrouter_api_key")
    localStorage.removeItem("openrouter_model")
    setApiKey("")
    setHasKey(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            OpenRouter API Key
          </DialogTitle>
          <DialogDescription>
            Enter your OpenRouter API key to generate websites. Get your key at{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              openrouter.ai/keys
            </a>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Free Models</div>
                {AVAILABLE_MODELS.filter((m) => m.category === "Free").map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Premium Models</div>
                {AVAILABLE_MODELS.filter((m) => m.category === "Premium").map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Free models don't consume credits. Premium models offer better quality.
            </p>
          </div>
          {hasKey && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              API key configured
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasKey && (
            <Button variant="outline" onClick={handleRemove} className="sm:mr-auto bg-transparent">
              Remove Key
            </Button>
          )}
          <Button onClick={handleSave} disabled={!apiKey.trim()}>
            Save Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
