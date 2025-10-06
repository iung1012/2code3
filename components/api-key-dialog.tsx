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
import { Key, Brain, Zap, DollarSign, Clock, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Model {
  id: string
  name: string
  description: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  top_provider: {
    context_length: number
    max_completion_tokens: number
  }
  architecture: {
    input_modalities: string[]
    output_modalities: string[]
  }
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
  const [openRouterModels, setOpenRouterModels] = useState<{ free: Model[], paid: Model[] }>({ free: [], paid: [] })
  const [loadingModels, setLoadingModels] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

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

  const fetchOpenRouterModels = async () => {
    if (!apiKey.trim()) return
    
    setLoadingModels(true)
    try {
      const response = await fetch("/api/models")
      const data = await response.json()
      setOpenRouterModels(data)
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error)
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    if (open && apiKey.trim()) {
      fetchOpenRouterModels()
    }
  }, [open, apiKey])

  const formatPrice = (price: string) => {
    const num = parseFloat(price)
    if (num === 0) return "Free"
    if (num < 0.001) return `$${(num * 1000).toFixed(2)}/1K`
    return `$${num.toFixed(6)}`
  }

  const formatContextLength = (length: number) => {
    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`
    if (length >= 1000) return `${(length / 1000).toFixed(0)}K`
    return length.toString()
  }

  const filteredFreeModels = openRouterModels.free.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredPaidModels = openRouterModels.paid.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
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
          {apiKey.trim() && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>AI Model Selection</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchOpenRouterModels}
                  disabled={loadingModels}
                >
                  {loadingModels ? "Loading..." : "Refresh Models"}
                </Button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <Tabs defaultValue="free" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="free" className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Free ({filteredFreeModels.length})
                  </TabsTrigger>
                  <TabsTrigger value="paid" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Paid ({filteredPaidModels.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="free" className="mt-4">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {loadingModels ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredFreeModels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No free models found
                      </div>
                    ) : (
                      filteredFreeModels.map((model) => (
                        <div
                          key={model.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedModel === model.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedModel(model.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate text-sm">{model.name}</h4>
                                {selectedModel === model.id && (
                                  <Check className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {model.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatContextLength(model.context_length)} context
                                </div>
                                <Badge variant="secondary">Free</Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="paid" className="mt-4">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {loadingModels ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredPaidModels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No paid models found
                      </div>
                    ) : (
                      filteredPaidModels.map((model) => (
                        <div
                          key={model.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedModel === model.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedModel(model.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate text-sm">{model.name}</h4>
                                {selectedModel === model.id && (
                                  <Check className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {model.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatContextLength(model.context_length)} context
                                </div>
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  {formatPrice(model.pricing.prompt)} input
                                </div>
                                <Badge variant="default">Paid</Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
          </div>
          )}
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
