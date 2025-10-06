import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  // UI State
  isGenerating: boolean
  showApiKeyDialog: boolean
  
  // Generated Code State
  generatedCode: { files: Record<string, string> } | null
  streamingCode: string
  streamingFiles: Record<string, string>
  currentFile: string
  rawStreamContent: string
  
  // Error State
  error: { message: string; details?: string; type?: string; code?: number } | null
  
  // Actions
  setIsGenerating: (isGenerating: boolean) => void
  setShowApiKeyDialog: (show: boolean) => void
  setGeneratedCode: (code: { files: Record<string, string> } | null) => void
  setStreamingCode: (code: string) => void
  setStreamingFiles: (files: Record<string, string>) => void
  setCurrentFile: (file: string) => void
  setRawStreamContent: (content: string) => void
  setError: (error: { message: string; details?: string; type?: string; code?: number } | null) => void
  resetGeneration: () => void
  resetAll: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      isGenerating: false,
      showApiKeyDialog: false,
      generatedCode: null,
      streamingCode: '',
      streamingFiles: {},
      currentFile: '',
      rawStreamContent: '',
      error: null,

      // Actions
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setShowApiKeyDialog: (showApiKeyDialog) => set({ showApiKeyDialog }),
      setGeneratedCode: (generatedCode) => set({ generatedCode }),
      setStreamingCode: (streamingCode) => set({ streamingCode }),
      setStreamingFiles: (streamingFiles) => set({ streamingFiles }),
      setCurrentFile: (currentFile) => set({ currentFile }),
      setRawStreamContent: (rawStreamContent) => set({ rawStreamContent }),
      setError: (error) => set({ error }),
      
      resetGeneration: () => set({
        isGenerating: false,
        generatedCode: null,
        streamingCode: '',
        streamingFiles: {},
        currentFile: '',
        rawStreamContent: '',
        error: null,
      }),
      
      resetAll: () => set({
        isGenerating: false,
        showApiKeyDialog: false,
        generatedCode: null,
        streamingCode: '',
        streamingFiles: {},
        currentFile: '',
        rawStreamContent: '',
        error: null,
      }),
    }),
    {
      name: 'ai-website-generator-storage',
      partialize: (state) => ({
        // Only persist certain parts of the state
        showApiKeyDialog: state.showApiKeyDialog,
      }),
    }
  )
)
