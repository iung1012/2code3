"use client"

import { useState, useEffect, useRef } from "react"
import { PromptInput } from "@/components/prompt-input"
import { CodePreview } from "@/components/code-preview"
import { ApiKeyDialog } from "@/components/api-key-dialog"
import DarkVeil from "@/components/ui/dark-veil"
import { Settings, AlertCircle, FileCode, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Image from "next/image"
import { webContainerManager } from "@/lib/webcontainer-manager"
import { EnhancedStreamingMessageParser } from "@/lib/enhanced-streaming-parser"

export default function Home() {
  const [generatedCode, setGeneratedCode] = useState<{
    files: Record<string, string>
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [error, setError] = useState<{ message: string; details?: string } | null>(null)
  const [streamingCode, setStreamingCode] = useState("")
  const [streamingFiles, setStreamingFiles] = useState<Record<string, string>>({})
  const [currentFile, setCurrentFile] = useState<string>("")
  const [rawStreamContent, setRawStreamContent] = useState("")
  const codeContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight
    }
  }, [rawStreamContent])

  const parseStreamingContent = (content: string) => {
    try {
      const cleanContent = content
        .replace(/```json\n?/gi, "")
        .replace(/```javascript\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim()

      // Try to extract individual files as they come in
      const filePattern = /"([^"]+\.(?:jsx?|tsx?|css|html|json))"\s*:\s*"((?:[^"\\]|\\.)*)"/g
      const files: Record<string, string> = {}
      let match
      let lastFileName = ""

      while ((match = filePattern.exec(cleanContent)) !== null) {
        const [, fileName, fileContent] = match
        const decodedContent = fileContent
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")

        files[fileName] = decodedContent
        lastFileName = fileName
      }

      if (Object.keys(files).length > 0) {
        setStreamingFiles(files)
        if (lastFileName) {
          setCurrentFile(lastFileName)
        }
      }
    } catch (e) {
      console.error("[v0] Error parsing streaming content:", e)
    }
  }

  // Function to check if modifications actually changed something significant
  const checkForSignificantChanges = (originalFiles: Record<string, string>, newFiles: Record<string, string>): boolean => {
    const originalKeys = Object.keys(originalFiles).sort()
    const newKeys = Object.keys(newFiles).sort()
    
    // Check if file structure changed
    if (JSON.stringify(originalKeys) !== JSON.stringify(newKeys)) {
      return true
    }
    
    // Check if any file content changed significantly (more than just whitespace)
    for (const key of originalKeys) {
      const original = originalFiles[key]?.replace(/\s+/g, ' ').trim()
      const modified = newFiles[key]?.replace(/\s+/g, ' ').trim()
      
      if (original !== modified) {
        // Check if it's more than just minor formatting changes
        const originalWords = original.split(' ').filter(w => w.length > 2)
        const modifiedWords = modified.split(' ').filter(w => w.length > 2)
        
        // If more than 10% of meaningful words changed, consider it significant
        const changes = originalWords.filter(word => !modifiedWords.includes(word)).length
        if (changes > originalWords.length * 0.1) {
          return true
        }
      }
    }
    
    return false
  }

  const handleGenerate = async (prompt: string, isModification: boolean = false) => {
    console.log("[v0] Starting generation with prompt:", prompt.substring(0, 100) + "...")
    console.log("[v0] Is modification:", isModification)
    
    setIsGenerating(true)
    setGeneratedCode(null)
    setError(null)
    setStreamingCode("")
    setStreamingFiles({})
    setCurrentFile("")
    setRawStreamContent("")

    const apiKey = localStorage.getItem("openrouter_api_key")
    if (!apiKey) {
      setIsGenerating(false)
      setShowApiKeyDialog(true)
      return
    }

    const selectedModel = localStorage.getItem("openrouter_model") || "google/gemini-2.0-flash-exp:free"
    console.log("[v0] Using model:", selectedModel)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Model": selectedModel,
        },
        body: JSON.stringify({ prompt, model: selectedModel }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError({
          message: errorData.error || "Failed to generate",
          details: errorData.details,
        })
        setIsGenerating(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""
      let files: Record<string, string> = {}

      // Initialize Enhanced Parser
      const enhancedParser = new EnhancedStreamingMessageParser({
        onArtifactOpen: (data) => {
          console.log("[EnhancedParser] Artifact opened:", data.title)
        },
        onActionOpen: (data) => {
          console.log("[EnhancedParser] Action opened:", data.action.type, data.action.filePath)
          if (data.action.type === 'file' && data.action.filePath) {
            const fileName = data.action.filePath.replace(/^\//, '') // Remove leading slash
            files[fileName] = data.action.content
            setStreamingFiles({ ...files })
          }
        },
        onActionClose: (data) => {
          console.log("[EnhancedParser] Action closed:", data.action.type)
          if (data.action.type === 'file' && data.action.filePath) {
            const fileName = data.action.filePath.replace(/^\//, '')
            files[fileName] = data.action.content
            setStreamingFiles({ ...files })
          }
        },
        onArtifactClose: (data) => {
          console.log("[EnhancedParser] Artifact closed:", data.title)
        },
      })

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") {
                try {
                  console.log("[v0] Raw accumulated content length:", accumulatedContent.length)

                  let cleanContent = accumulatedContent
                    .replace(/```json\n?/gi, "")
                    .replace(/```javascript\n?/gi, "")
                    .replace(/```\n?/g, "")
                    .trim()

                  console.log("[v0] Clean content preview:", cleanContent.substring(0, 200) + "...")

                  // Extract just the JSON object
                  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
                  if (jsonMatch) {
                    cleanContent = jsonMatch[0]
                  }

                  console.log("[v0] Cleaned content preview:", cleanContent.substring(0, 200))

                  // Validate basic JSON structure
                  if (!cleanContent.startsWith("{") || !cleanContent.endsWith("}")) {
                    throw new Error("Content does not appear to be valid JSON")
                  }

                  // Advanced validation and fixing for incomplete JSON
                  let inString = false
                  let escaped = false
                  let braceCount = 0
                  let lastValidPos = cleanContent.length

                  for (let i = 0; i < cleanContent.length; i++) {
                    const char = cleanContent[i]

                    if (escaped) {
                      escaped = false
                      continue
                    }

                    if (char === "\\") {
                      escaped = true
                      continue
                    }

                    if (char === '"' && !escaped) {
                      inString = !inString
                    }

                    if (!inString) {
                      if (char === "{") braceCount++
                      if (char === "}") braceCount--
                    }
                  }

                  // If we have unterminated string or unbalanced braces, try to fix
                  if (inString || braceCount !== 0) {
                    console.log("[v0] Detected incomplete JSON - inString:", inString, "braceCount:", braceCount)

                    // Find the last complete file entry with improved regex
                    const fileEntries = cleanContent.match(
                      /"[^"]+\.(jsx?|tsx?|css|html|json|md|txt|svg|png|jpg|jpeg|gif|ico)"\s*:\s*"(?:[^"\\]|\\.)*"/g,
                    )

                    if (fileEntries && fileEntries.length > 0) {
                      // Rebuild JSON with only complete entries
                      const completeFiles = fileEntries.join(",\n")
                      cleanContent = `{\n"files": {\n${completeFiles}\n}\n}`
                      console.log("[v0] Rebuilt JSON with", fileEntries.length, "complete files")
                    } else {
                      // Try alternative approach - find any complete JSON structure
                      const jsonMatch = cleanContent.match(/\{[\s\S]*"files"[\s\S]*\}/)
                      if (jsonMatch) {
                        cleanContent = jsonMatch[0]
                        console.log("[v0] Extracted complete JSON structure")
                    } else {
                      throw new Error("No complete file entries found in response")
                      }
                    }
                  }

                  // Additional cleanup
                  cleanContent = cleanContent
                    .replace(/"([^"]+)"\s+"/g, '"$1": "')
                    .replace(/,(\s*[}\]])/g, "$1")
                    .replace(/\\"\s*}/g, '"}')
                    .replace(/\\\s*}/g, '"}')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']')
                    .replace(/\n\s*\n/g, '\n')
                    .trim()

                  let parsedContent: any
                  try {
                    parsedContent = JSON.parse(cleanContent)
                  } catch (parseError) {
                    console.log("[v0] Failed to parse JSON, trying fallback methods:", parseError)
                    
                    // Try to extract JSON from markdown code blocks
                    const jsonMatch = accumulatedContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
                    if (jsonMatch) {
                      try {
                        parsedContent = JSON.parse(jsonMatch[1])
                        console.log("[v0] Successfully parsed JSON from code block")
                      } catch (codeBlockError) {
                        console.log("[v0] Failed to parse JSON from code block:", codeBlockError)
                        throw new Error("Invalid JSON format in AI response")
                      }
                    } else {
                      // Try to find any JSON-like structure
                      const jsonStart = accumulatedContent.indexOf('{')
                      const jsonEnd = accumulatedContent.lastIndexOf('}')
                      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                        const jsonCandidate = accumulatedContent.substring(jsonStart, jsonEnd + 1)
                        try {
                          parsedContent = JSON.parse(jsonCandidate)
                          console.log("[v0] Successfully parsed JSON from extracted content")
                        } catch (extractError) {
                          console.log("[v0] Failed to parse extracted JSON:", extractError)
                          throw new Error("Could not extract valid JSON from AI response")
                        }
                      } else {
                        throw new Error("No JSON structure found in AI response")
                      }
                    }
                  }
                  
                  console.log("[v0] Parsed content structure:", {
                    hasFiles: !!parsedContent.files,
                    filesType: typeof parsedContent.files,
                    isArray: Array.isArray(parsedContent.files),
                    directKeys: Object.keys(parsedContent).filter(k => k !== 'files')
                  })

                  // Handle different JSON structures
                  let files: Record<string, string> = {}
                  
                  if (parsedContent.files) {
                    // Case 1: { "files": { "file.js": "content" } }
                    if (typeof parsedContent.files === "object" && !Array.isArray(parsedContent.files)) {
                      files = parsedContent.files as Record<string, string>
                    }
                    // Case 2: { "files": [{ "path": "file.js", "content": "content" }] }
                    else if (Array.isArray(parsedContent.files)) {
                      files = {}
                      parsedContent.files.forEach((file: any) => {
                        if (file.path && file.content !== undefined) {
                          files[file.path] = file.content
                        }
                      })
                    }
                  } else {
                    // Case 3: Direct object { "file.js": "content" }
                    files = parsedContent as Record<string, string>
                  }
                  
                  // Fix common export issues
                  Object.keys(files).forEach(filePath => {
                    if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
                      let content = files[filePath]
                      
                      // Fix App.jsx export issues
                      if (filePath === 'src/App.jsx' || filePath.endsWith('/App.jsx')) {
                        console.log("[v0] Fixing App.jsx exports...")
                        
                        // Replace named exports with default exports
                        content = content.replace(/export\s*{\s*App\s*}/g, 'export default App')
                        content = content.replace(/export\s*{\s*default\s+App\s*}/g, 'export default App')
                        content = content.replace(/export\s*{\s*App\s*as\s+default\s*}/g, 'export default App')
                        
                        // Handle various export patterns
                        content = content.replace(/export\s*{\s*App\s*,\s*default\s*}/g, 'export default App')
                        content = content.replace(/export\s*{\s*default\s*,\s*App\s*}/g, 'export default App')
                        
                        // Ensure there's a default export
                        if (!content.includes('export default')) {
                          console.log("[v0] Adding missing default export to App.jsx")
                          
                          // Try different patterns to add default export
                          if (content.includes('function App(')) {
                            // Add export default after function declaration
                            content = content.replace(/(function\s+App\s*\([^)]*\)\s*{[^}]*})\s*$/, '$1\nexport default App')
                          } else if (content.includes('const App =')) {
                            // Add export default after const declaration
                            content = content.replace(/(const\s+App\s*=\s*[^;]+;?)\s*$/, '$1\nexport default App')
                          } else if (content.includes('class App')) {
                            // Add export default after class declaration
                            content = content.replace(/(class\s+App\s*[^{]*{[^}]*})\s*$/, '$1\nexport default App')
                          } else {
                            // Last resort: add at the end
                            content = content.trim() + '\nexport default App'
                          }
                        }
                        
                        console.log("[v0] App.jsx export fix completed")
                      }
                      
                      // Fix other React component exports
                      if (filePath.includes('src/') && (filePath.endsWith('.jsx') || filePath.endsWith('.js'))) {
                        // Ensure React components use default exports
                        const componentName = filePath.split('/').pop()?.replace(/\.(jsx?|tsx?)$/, '') || ''
                        
                        if (componentName && componentName !== 'App' && componentName !== 'main' && componentName !== 'index') {
                          // Check if it's a React component (has JSX)
                          if (content.includes('<') && content.includes('>')) {
                            // Replace named exports with default exports for components
                            const namedExportPattern = new RegExp(`export\\s*{\\s*${componentName}\\s*}`, 'g')
                            content = content.replace(namedExportPattern, `export default ${componentName}`)
                            
                            // Add default export if missing
                            if (!content.includes('export default') && content.includes(`function ${componentName}(`)) {
                              content = content.replace(new RegExp(`(function\\s+${componentName}\\s*\\([^)]*\\)\\s*{[^}]*})\\s*$`), `$1\nexport default ${componentName}`)
                            }
                          }
                        }
                      }
                      
                      files[filePath] = content
                    }
                  })

                  // Ensure we have the correct structure
                  const finalContent: { files: Record<string, string> } = {
                    files: files
                  }

                  const fileCount = Object.keys(files).length
                  if (fileCount === 0) {
                    // Fallback: Use files detected by Enhanced Parser
                    if (Object.keys(files).length === 0) {
                      console.log("[v0] No files from JSON parsing, checking Enhanced Parser results...")
                      // The Enhanced Parser should have populated files during streaming
                      if (Object.keys(files).length === 0) {
                    throw new Error("No files were generated")
                      }
                    }
                  }

                  console.log("[v0] Successfully parsed code with", Object.keys(files).length, "files")
                  
                  // Process diff/patch blocks if this is a modification
                  if (isModification && generatedCode?.files) {
                    console.log("[v0] Processing modification with diff/patch system")
                    
                    const processedFiles: Record<string, string> = {}
                    let hasAnyChanges = false
                    
                    // Process each file for diff/patch blocks
                    Object.keys(files).forEach(filePath => {
                      const fileContent = files[filePath]
                      const originalContent = generatedCode.files[filePath]
                      
                      // Check if this file has diff/patch blocks
                      if (fileContent.includes('<<<<<<< SEARCH') && 
                          fileContent.includes('=======') && 
                          fileContent.includes('>>>>>>> REPLACE')) {
                        
                        console.log(`[v0] Processing diff/patch blocks for ${filePath}`)
                        
                        // Import the diff/patch functions
                        const { applyDiffPatches } = require('../lib/diff-patch')
                        const result = applyDiffPatches(originalContent, fileContent)
                        
                        if (result.hasChanges) {
                          processedFiles[filePath] = result.modifiedContent
                          hasAnyChanges = true
                          console.log(`[v0] Applied changes to ${filePath}`)
                        } else {
                          processedFiles[filePath] = originalContent
                          console.log(`[v0] No changes applied to ${filePath}`)
                        }
                      } else {
                        // No diff/patch blocks, use original content
                        processedFiles[filePath] = originalContent
                      }
                    })
                    
                    if (!hasAnyChanges) {
                      console.log("[v0] No changes detected in modification")
                      return
                    }
                    
                    // Update the final content with processed files
                    finalContent.files = processedFiles
                    console.log("[v0] Modification processed successfully with diff/patch system")
                  }
                  
                  setGeneratedCode(finalContent)
                } catch (e) {
                  console.error("[v0] Failed to parse final JSON:", e)
                  console.error("[v0] Accumulated content:", accumulatedContent.substring(0, 500))

                  let errorDetails = `A resposta da IA estava incompleta ou malformada. `

                  const errorMessage = e instanceof Error ? e.message : String(e);
                  
                  if (errorMessage.includes("Unterminated string") || errorMessage.includes("incomplete")) {
                    errorDetails += `A IA não terminou de gerar todo o código. Isso geralmente acontece quando:\n\n`
                    errorDetails += `• A resposta é muito longa para o modelo processar\n`
                    errorDetails += `• O modelo atingiu seu limite de tokens\n`
                    errorDetails += `• Houve um timeout na conexão\n\n`
                  } else if (errorMessage.includes("Expected") || errorMessage.includes("JSON")) {
                    errorDetails += `Erro de sintaxe JSON: ${errorMessage}\n\n`
                  } else if (errorMessage.includes("No complete file entries")) {
                    errorDetails += `A IA começou a responder mas não completou nenhum arquivo.\n\n`
                  }

                  errorDetails += `Dicas para resolver:\n`
                  errorDetails += `• Tente um prompt mais simples e específico\n`
                  errorDetails += `• Use um modelo diferente (tente qwen/qwen3-coder ou anthropic/claude)\n`
                  errorDetails += `• Divida seu projeto em partes menores\n`
                  errorDetails += `• Aguarde alguns minutos e tente novamente`

                  setError({
                    message: "Falha ao processar código gerado",
                    details: errorDetails,
                  })
                }
                continue
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.error) {
                  let errorDetails = parsed.details || ""

                  if (parsed.code === 429) {
                    errorDetails +=
                      "\n\nSuggestions:\n• Try a different model from the settings menu\n• Wait a few minutes and try again\n• Consider using a paid model for higher rate limits"
                  }

                  setError({
                    message: parsed.error,
                    details: errorDetails,
                  })
                  break
                }
                if (parsed.content) {
                  accumulatedContent += parsed.content
                  
                  // Process with Enhanced Parser
                  enhancedParser.parse("generation", accumulatedContent)
                  
                  setStreamingCode(accumulatedContent)
                  setRawStreamContent(accumulatedContent)
                  parseStreamingContent(accumulatedContent)
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error generating code:", error)
      setError({
        message: "Network error",
        details: "Failed to connect to the server. Please check your internet connection and try again.",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleFixWithAI = async (errorMessage: string, currentFiles: Record<string, string>) => {
    const fixPrompt = `The following code has an error. Please fix it and return the corrected code.

ERROR:
${errorMessage}

CURRENT CODE:
${JSON.stringify(currentFiles, null, 2)}

Please analyze the error and return the complete fixed code in the same JSON format with all files.`

    await handleGenerate(fixPrompt)
  }

  const handleModify = async (prompt: string) => {
    console.log("[v0] Starting modification with prompt:", prompt)
    
    if (!generatedCode?.files) {
      console.error("[v0] No generated code available for modification")
      return
    }

    console.log("[v0] Current files count:", Object.keys(generatedCode.files).length)

      const modificationPrompt = `MODIFICATION REQUEST:
    ${prompt.trim()}

    CURRENT FILES (use these as the EXACT base - do NOT change anything unless specifically requested):
    ${JSON.stringify(generatedCode.files, null, 2)}

    CRITICAL INSTRUCTIONS FOR MODIFICATIONS:
    You are modifying existing React + Vite files. You MUST output ONLY the changes required using the following SEARCH/REPLACE block format. Do NOT output the entire file.

    Format Rules:
    1. Start with <<<<<<< SEARCH
    2. Provide the exact lines from the current code that need to be replaced
    3. Use ======= to separate the search block from the replacement
    4. Provide the new lines that should replace the original lines
    5. End with >>>>>>> REPLACE
    6. You can use multiple SEARCH/REPLACE blocks if changes are needed in different parts of the file
    7. To insert code, use an empty SEARCH block (only <<<<<<< SEARCH and ======= on their lines) if inserting at the very beginning
    8. To delete code, provide the lines to delete in the SEARCH block and leave the REPLACE block empty
    9. IMPORTANT: The SEARCH block must *exactly* match the current code, including indentation and whitespace

    MODIFICATION FOCUS:
    - If requesting dark/light theme toggle: Only add the toggle functionality, keep existing design
    - If requesting button functionality: Only add the specific functionality, don't change the button's appearance
    - If requesting layout changes: Only modify the specific layout elements mentioned
    - If requesting new features: Add them without changing existing features
    
    SPECIFIC MODIFICATION GUIDELINES:
    - For "faça tela escura e clara": Add theme toggle functionality, keep all existing styling and layout
    - For "adicione botão de login com google": Add Google login button, don't change existing buttons or layout
    - For "mude a cor": Only change the specific colors mentioned, keep everything else identical
    - For "adicione funcionalidade": Add only the requested functionality, don't modify existing features

    Example Modifying Code:
    \`\`\`
    Adding dark mode toggle...
    <<<<<<< SEARCH
    function App() {
      return (
        <div className="bg-white">
          <h1>My App</h1>
        </div>
      );
    }
    =======
    function App() {
      const [isDark, setIsDark] = useState(false);
      
      return (
        <div className={isDark ? "bg-black text-white" : "bg-white"}>
          <button onClick={() => setIsDark(!isDark)}>
            Toggle Theme
          </button>
          <h1>My App</h1>
        </div>
      );
    }
    >>>>>>> REPLACE
    \`\`\`

    IMPORTANT: Return the response in this EXACT JSON format:
    {
      "files": {
        "filename1.js": "file content with SEARCH/REPLACE blocks",
        "filename2.css": "file content with SEARCH/REPLACE blocks"
      }
    }

    JSON FORMAT REQUIREMENTS:
    - Return ONLY valid JSON (no markdown, no code blocks)
    - Use proper escaping: \\" for quotes, \\n for newlines
    - Ensure ALL property names have colons after them: "property": "value"
    - NO trailing commas
    - Double-check your JSON syntax before responding

    Remember: Use SEARCH/REPLACE blocks to make precise modifications without regenerating entire files.`

    await handleGenerate(modificationPrompt, true)
  }

  return (
    <div className="min-h-screen bg-black relative" style={{ isolation: "isolate" }}>
      <DarkVeil />

      <header
        className="border-b border-border/40 backdrop-blur-xl bg-background/70 sticky top-0 shadow-sm relative"
        style={{ zIndex: 50 }}
      >
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-2code.png" alt="2code" width={120} height={34} className="h-8 w-auto" priority />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowApiKeyDialog(true)}
            className="rounded-full hover:bg-muted/50 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {!generatedCode && !isGenerating ? (
        <div className="container mx-auto px-6 py-20 md:py-32 relative" style={{ zIndex: 10 }}>
          <div className="max-w-3xl mx-auto text-center space-y-12">
            <div className="space-y-8">
              <h1 className="text-6xl md:text-7xl font-semibold tracking-tight text-balance leading-[1.1]">
                Crie sites incríveis com{" "}
                <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 bg-clip-text text-transparent">
                  inteligência artificial
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed font-light">
                Descreva sua ideia e veja a IA gerar um site completo em React + Vite em segundos, com preview ao vivo e
                código editável.
              </p>
            </div>

            {error && (
              <Alert
                variant="destructive"
                className="max-w-2xl mx-auto text-left border-destructive/30 bg-destructive/5 rounded-2xl"
              >
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="text-lg font-semibold">{error.message}</AlertTitle>
                {error.details && (
                  <AlertDescription className="text-sm mt-2 opacity-90">{error.details}</AlertDescription>
                )}
              </Alert>
            )}

            <PromptInput onGenerate={handleGenerate} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-20">
              <div className="group p-10 bg-card/30 backdrop-blur-xl border border-border/40 rounded-3xl hover:bg-card/50 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="text-5xl mb-5 group-hover:scale-105 transition-transform duration-300">⚡</div>
                <h3 className="font-semibold text-lg mb-3">Geração Instantânea</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">
                  Gerar sites completos em segundos com IA avançada
                </p>
              </div>
              <div className="group p-10 bg-card/30 backdrop-blur-xl border border-border/40 rounded-3xl hover:bg-card/50 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="text-5xl mb-5 group-hover:scale-105 transition-transform duration-300">🎨</div>
                <h3 className="font-semibold text-lg mb-3">Design Moderno</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">
                  Designes bonitos e responsivos alimentados por React
                </p>
              </div>
              <div className="group p-10 bg-card/30 backdrop-blur-xl border border-border/40 rounded-3xl hover:bg-card/50 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="text-5xl mb-5 group-hover:scale-105 transition-transform duration-300">🚀</div>
                <h3 className="font-semibold text-lg mb-3">Preview ao Vivo</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">
                  Veja seu site rodando instantaneamente com WebContainer
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : isGenerating && !generatedCode ? (
        <div className="container mx-auto px-6 py-16 relative" style={{ zIndex: 10 }}>
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Gerando seu site...</h2>
              <p className="text-muted-foreground text-lg font-light">
                Acompanhe a IA criando os arquivos em tempo real
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="bg-card/50 backdrop-blur-xl rounded-3xl border border-border/40 overflow-hidden shadow-2xl animate-fade-in">
                <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/60 animate-pulse"></div>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium ml-2">
                    {currentFile || "Gerando código..."}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <div className="w-1 h-4 bg-primary/40 rounded-full animate-wave"></div>
                    <div className="w-1 h-4 bg-primary/40 rounded-full animate-wave delay-100"></div>
                    <div className="w-1 h-4 bg-primary/40 rounded-full animate-wave delay-200"></div>
                  </div>
                </div>
                <div
                  ref={codeContainerRef}
                  className="p-8 h-[500px] overflow-y-auto scrollbar-hide bg-gradient-to-b from-black/5 to-black/10 relative"
                >
                  {currentFile && streamingFiles[currentFile] ? (
                    <pre className="text-sm text-foreground/90 font-mono whitespace-pre-wrap leading-relaxed">
                      {streamingFiles[currentFile]}
                      <span className="inline-block w-2 h-5 bg-primary ml-1 rounded-sm animate-cursor-blink"></span>
                    </pre>
                  ) : rawStreamContent ? (
                    <pre className="text-sm text-muted-foreground/70 font-mono whitespace-pre-wrap leading-relaxed">
                      {rawStreamContent}
                      <span className="inline-block w-2 h-5 bg-primary ml-1 rounded-sm animate-cursor-blink"></span>
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-4">
                        <div className="text-4xl animate-bounce">⚡</div>
                        <p className="text-sm text-muted-foreground">Aguardando resposta da IA...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card/50 to-transparent pointer-events-none"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative" style={{ zIndex: 10 }}>
          <CodePreview
            code={generatedCode}
            isGenerating={isGenerating}
            onBack={() => setGeneratedCode(null)}
            onFixWithAI={handleFixWithAI}
            onModify={handleModify}
          />
        </div>
      )}

      <ApiKeyDialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog} />
    </div>
  )
}
