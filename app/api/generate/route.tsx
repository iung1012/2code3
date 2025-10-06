import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt, model } = await request.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const apiKey = request.headers.get("x-api-key")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const selectedModel = model || "google/gemini-2.0-flash-exp:free"
    console.log("[v0] API using model:", selectedModel)

    const systemPrompt = `You are an expert React + Vite developer. Your role is to generate complete, production-ready React + Vite projects.

    THINK HOLISTICALLY BEFORE GENERATING CODE:
    - Understand the full scope of the request before starting
    - Plan the component structure and file organization
    - Consider all necessary files and dependencies
    - Ensure consistency across all generated files

    CRITICAL RULES (NEVER VIOLATE):
    1. ALWAYS generate ALL required files for a React + Vite project
    2. NEVER use placeholders like "// rest of code here" or "// add more features"
    3. ALWAYS provide COMPLETE, WORKING code for every file
    4. NEVER skip the src/index.css file - it is MANDATORY
    5. ALWAYS return valid, parseable JSON (no markdown, no code blocks)
    6. CRITICAL: App.jsx MUST use "export default App" (not named exports)
    7. ALL React components MUST use default exports
    8. main.jsx MUST be able to import App with "import App from './App.jsx'"

    MODIFICATION MODE DETECTION:
    - If the request contains "CURRENT FILES" and "MODIFICATION REQUEST", you are in MODIFICATION MODE
    - In MODIFICATION MODE: Use SEARCH/REPLACE blocks to make precise changes
    - In MODIFICATION MODE: Do NOT regenerate entire files - use diff/patch format
    - In MODIFICATION MODE: Keep all existing functionality intact unless specifically asked to change it
    - In MODIFICATION MODE: Preserve exact formatting, indentation, and whitespace

REQUIRED FILES FOR EVERY PROJECT:
1. package.json - Must include:
   {
     "name": "project-name",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview"
     },
     "dependencies": {
       "react": "^18.3.1",
       "react-dom": "^18.3.1"
     },
     "devDependencies": {
       "@vitejs/plugin-react": "^4.3.4",
       "vite": "^6.0.3"
     }
   }

2. vite.config.js - Must include:
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'
   
   export default defineConfig({
     plugins: [react()],
   })

3. index.html - Must be in root with:
   <!DOCTYPE html>
   <html lang="pt-BR">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <title>Project Title</title>
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/src/main.jsx"></script>
     </body>
   </html>

4. src/main.jsx - Must include:
   import { createRoot } from 'react-dom/client'
   import App from './App.jsx'
   import './index.css'
   
   createRoot(document.getElementById('root')).render(<App />)

5. src/App.jsx - MUST use default export:
   import React from 'react'
   import './App.css'
   
   function App() {
     return (
       <div className="App">
         {/* Your component content */}
       </div>
     )
   }
   
   export default App  // CRITICAL: Must be default export

6. src/App.css - Styles for App component

7. src/index.css - MANDATORY global styles. Minimum content:
   * {
     margin: 0;
     padding: 0;
     box-sizing: border-box;
   }
   
   body {
     font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
   }`

    const userPrompt = prompt.includes("MODIFICATION REQUEST")
      ? prompt
      : `Create a React + Vite project for: ${prompt}

Generate ALL required files with complete, working code. Make it visually appealing with modern styling.`

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://ai-website-builder.vercel.app",
              "X-Title": "AI Website Builder",
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: true,
              temperature: 0.7,
              max_tokens: 4000,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error?.metadata?.raw || errorData.error?.message || `HTTP ${response.status}`

            let userFriendlyMessage = "Erro ao gerar código"
            let errorCode = response.status
            let errorType = "unknown"

            if (response.status === 429) {
              userFriendlyMessage = `Rate limit atingido: ${errorMessage}. Tente outro modelo ou aguarde alguns minutos.`
              errorType = "rate_limit"
            } else if (response.status === 401) {
              userFriendlyMessage = "API key inválida. Verifique sua chave nas configurações."
              errorType = "authentication"
            } else if (response.status === 402) {
              userFriendlyMessage = "Créditos insuficientes. Adicione créditos ou use modelos gratuitos."
              errorType = "quota"
            } else if (response.status >= 500) {
              userFriendlyMessage = "Erro interno do servidor. Tente novamente em alguns minutos."
              errorType = "server_error"
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: userFriendlyMessage, 
              code: errorCode,
              type: errorType,
              details: errorMessage 
            })}\n\n`))
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            controller.close()
            return
          }

          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error("No response body")
          }

          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"))
                  continue
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                } catch (e) {
                  // Skip invalid JSON chunks
                  console.error("[v0] Failed to parse chunk:", e)
                }
              }
            }
          }

          controller.close()
        } catch (error) {
          console.error("[v0] Stream error:", error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Erro ao processar resposta da IA" })}\n\n`),
          )
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[v0] API error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
