"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Code2,
  Eye,
  Loader2,
  Download,
  RefreshCw,
  Terminal,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import JSZip from "jszip"
import { webContainerManager } from "@/lib/webcontainer-manager"
import { ModificationChat } from "./modification-chat"

interface CodePreviewProps {
  code: { files: Record<string, string> } | null
  isGenerating: boolean
  onBack: () => void
  onFixWithAI?: (errorMessage: string, files: Record<string, string>) => void
  onModify?: (prompt: string) => Promise<void>
}

export function CodePreview({ code, isGenerating, onBack, onFixWithAI, onModify }: CodePreviewProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview")
  const [selectedFile, setSelectedFile] = useState<string>("")
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [logs, setLogs] = useState<string[]>([])
  const [isBooting, setIsBooting] = useState(false)
  const [error, setError] = useState<string>("")
  const [runtimeError, setRuntimeError] = useState<string>("")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const stripAnsi = (str: string): string => {
    return str
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
      .replace(/\x1b\([0-9;]*[a-zA-Z]/g, "")
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim()
  }

  useEffect(() => {
    if (code?.files) {
      const files = Object.keys(code.files)
      if (files.length > 0) {
        setSelectedFile(files[0])
        
        // Only boot if we don't have a preview URL yet (first time)
        // The WebContainerManager will handle code changes internally
        if (!previewUrl && !isBooting) {
          bootWebContainer()
        }
      }
    }

    return () => {
      // WebContainer cleanup is now handled by the manager
    }
  }, [code?.files]) // Remove previewUrl and isBooting from dependencies

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "runtime-error") {
        console.log("[v0] Runtime error detected:", event.data.error)
        setRuntimeError(event.data.error)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  const addLog = (message: string) => {
    const cleanMessage = stripAnsi(message)
    if (cleanMessage) {
      console.log("[v0]", cleanMessage)
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${cleanMessage}`])
    }
  }

  const bootWebContainer = async () => {
    if (!code?.files) return

    // Prevent multiple simultaneous boots
    if (isBooting) {
      addLog("WebContainer boot already in progress...")
      return
    }

    setIsBooting(true)
    setLogs([])
    setError("")
    setPreviewUrl("")
    addLog("Initializing WebContainer...")

    try {
      // Create a hash of the current code to detect changes
      const codeHash = JSON.stringify(code.files)
      
      addLog("Getting WebContainer instance...")
      const webcontainer = await webContainerManager.getWebContainer(codeHash)
      addLog("WebContainer ready")

      const files = { ...code.files }
      if (!files["src/index.css"]) {
        addLog("Warning: src/index.css missing, creating default file...")
        files["src/index.css"] = "* { margin: 0; padding: 0; box-sizing: border-box; }"
      }

      const fileSystem: any = {
        "package.json": {
          file: {
            contents: JSON.stringify(
              {
                name: "generated-website",
                private: true,
                version: "0.0.0",
                type: "module",
                scripts: {
                  dev: "vite",
                  build: "vite build",
                  preview: "vite preview",
                },
                dependencies: {
                  react: "^18.3.1",
                  "react-dom": "^18.3.1",
                },
                devDependencies: {
                  "@vitejs/plugin-react": "^4.3.1",
                  vite: "^5.4.2",
                },
              },
              null,
              2,
            ),
          },
        },
        "vite.config.js": {
          file: {
            contents:
              "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})",
          },
        },
        "index.html": {
          file: {
            contents:
              '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Generated Website</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>',
          },
        },
      }

      for (const [path, content] of Object.entries(files)) {
        const parts = path.split("/")
        let current = fileSystem

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          if (!current[part]) {
            current[part] = { directory: {} }
          }
          current = current[part].directory
        }

        const fileName = parts[parts.length - 1]
        current[fileName] = {
          file: {
            contents: content,
          },
        }
      }

      addLog("Writing files to WebContainer...")
      await webcontainer.mount(fileSystem)
      addLog("Files written successfully")

      addLog("Installing dependencies (this may take a moment)...")
      const installProcess = await webcontainer.spawn("npm", ["install"])

      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addLog(data)
          },
        }),
      )

      const installExitCode = await installProcess.exit
      if (installExitCode !== 0) {
        throw new Error("Installation failed")
      }

      addLog("Dependencies installed successfully")

      webcontainer.on("server-ready", (port, url) => {
        addLog(`Server ready on port ${port} at ${url}`)
        setPreviewUrl(url)
        setIsBooting(false)
      })

      addLog("Starting development server...")
      const devProcess = await webcontainer.spawn("npm", ["run", "dev"])

      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addLog(data)
          },
        }),
      )
    } catch (error) {
      console.error("[v0] WebContainer error:", error)
      
      // Handle specific WebContainer errors
      if (error instanceof Error && error.message.includes("Only a single WebContainer instance")) {
        addLog("WebContainer instance conflict detected")
        addLog("Attempting to reuse existing instance...")
        
        // Try to get existing instance
        try {
          const existingInstance = webContainerManager.getInstance()
          if (existingInstance) {
            addLog("Reusing existing WebContainer instance")
            // Continue with the existing instance - just update files
            const files = { ...code.files }
            if (!files["src/index.css"]) {
              addLog("Warning: src/index.css missing, creating default file...")
              files["src/index.css"] = "* { margin: 0; padding: 0; box-sizing: border-box; }"
            }

            const fileSystem: any = {
              "package.json": {
                file: {
                  contents: JSON.stringify(
                    {
                      name: "generated-website",
                      private: true,
                      version: "0.0.0",
                      type: "module",
                      scripts: {
                        dev: "vite",
                        build: "vite build",
                        preview: "vite preview",
                      },
                      dependencies: {
                        react: "^18.3.1",
                        "react-dom": "^18.3.1",
                      },
                      devDependencies: {
                        "@vitejs/plugin-react": "^4.3.1",
                        vite: "^5.4.2",
                      },
                    },
                    null,
                    2,
                  ),
                },
              },
              "vite.config.js": {
                file: {
                  contents:
                    "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})",
                },
              },
              "index.html": {
                file: {
                  contents:
                    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Generated Website</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>',
                },
              },
            }

            for (const [path, content] of Object.entries(files)) {
              const parts = path.split("/")
              let current = fileSystem

              for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i]
                if (!current[part]) {
                  current[part] = { directory: {} }
                }
                current = current[part].directory
              }

              const fileName = parts[parts.length - 1]
              current[fileName] = {
                file: {
                  contents: content,
                },
              }
            }

            addLog("Writing files to WebContainer...")
            await existingInstance.mount(fileSystem)
            addLog("Files written successfully")

            addLog("Installing dependencies (this may take a moment)...")
            const installProcess = await existingInstance.spawn("npm", ["install"])
            installProcess.output.pipeTo(
              new WritableStream({
                write(data) {
                  addLog(data)
                },
              }),
            )
            await installProcess.exit

            addLog("Dependencies installed successfully")
            addLog("Starting development server...")

            const devProcess = await existingInstance.spawn("npm", ["run", "dev"])
            devProcess.output.pipeTo(
              new WritableStream({
                write(data) {
                  addLog(data)
                },
              }),
            )

            existingInstance.on("server-ready", (port, url) => {
              addLog(`Server ready on port ${port} at ${url}`)
              setPreviewUrl(url)
              setIsBooting(false)
            })

            return
          }
        } catch (reuseError) {
          console.error("[v0] Failed to reuse existing instance:", reuseError)
        }
        
        setError("WebContainer Instance Conflict: A WebContainer instance is already running. Please wait for the current operation to complete or use the Reset button to restart.")
      } else {
        let errorMsg = `WebContainer failed: ${error instanceof Error ? error.message : "Unknown error"}`
        
        if (error instanceof Error) {
          if (error.message.includes("SharedArrayBuffer")) {
            errorMsg = "WebContainer requires Chrome/Edge browser or Cross-Origin-Isolation headers"
            addLog("Note: WebContainer requires Chrome/Edge browser or Cross-Origin-Isolation headers")
          } else {
            addLog(`Error: ${error.message}`)
          }
        }
        
        setError(errorMsg)
      }
      
      setIsBooting(false)
    }
  }

  const handleRefresh = () => {
    if (iframeRef.current && previewUrl) {
      const url = new URL(previewUrl)
      url.searchParams.set("_refresh", Date.now().toString())
      iframeRef.current.src = url.toString()
    }
  }

  const downloadProject = async () => {
    if (!code?.files) return

    try {
      const zip = new JSZip()

      const packageJson = {
        name: "generated-website",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.3.1",
          vite: "^5.4.2",
        },
      }
      zip.file("package.json", JSON.stringify(packageJson, null, 2))

      const viteConfig =
        "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n"
      zip.file("vite.config.js", viteConfig)

      const indexHtml =
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Generated Website</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n'
      zip.file("index.html", indexHtml)

      const readme =
        "# Generated Website\n\nThis project was generated by AI Website Generator.\n\n## Getting Started\n\n1. Install dependencies:\n```bash\nnpm install\n```\n\n2. Run development server:\n```bash\nnpm run dev\n```\n\n3. Build for production:\n```bash\nnpm run build\n```\n\n## Deploy\n\nYou can deploy this project to:\n- Netlify\n- Vercel\n- GitHub Pages\n- Any static hosting service\n\nSimply run `npm run build` and upload the `dist` folder.\n"
      zip.file("README.md", readme)

      const gitignore =
        "# Dependencies\nnode_modules/\n\n# Build\ndist/\n\n# Logs\n*.log\n\n# Environment\n.env\n.env.local\n\n# Editor\n.vscode/\n.idea/\n\n# OS\n.DS_Store\n"
      zip.file(".gitignore", gitignore)

      for (const [filePath, content] of Object.entries(code.files)) {
        zip.file(filePath, content)
      }

      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "generated-website.zip"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("[v0] Error downloading project:", error)
      alert("Error downloading project. Please try again.")
    }
  }

  const handleFixWithAI = () => {
    if (!code?.files) return

    const errorToFix = runtimeError || error
    if (errorToFix && onFixWithAI) {
      onFixWithAI(errorToFix, code.files)
    }
  }

  const handleResetWebContainer = async () => {
    try {
      addLog("Resetting WebContainer...")
      await webContainerManager.forceRestart()
      setError("")
      setPreviewUrl("")
      setIsBooting(false)
      addLog("WebContainer reset complete")
    } catch (error) {
      console.error("[v0] Failed to reset WebContainer:", error)
      addLog("Failed to reset WebContainer")
    }
  }

  if (!code) return null

  const files = Object.keys(code.files)

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadProject} className="rounded-xl bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            {activeTab === "preview" && previewUrl && (
              <Button variant="outline" size="sm" onClick={handleRefresh} className="rounded-xl bg-transparent">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            )}
            <Button
              variant={activeTab === "preview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("preview")}
              className="rounded-xl"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button
              variant={activeTab === "code" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("code")}
              className="rounded-xl"
            >
              <Code2 className="w-4 h-4 mr-2" />
              Code
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-[2] overflow-hidden">
          <div className={`h-full w-full flex flex-col ${activeTab === "preview" ? "" : "hidden"}`}>
            {(error || runtimeError) && (
              <div className="flex-1 flex items-center justify-center bg-background">
                <div className="text-center space-y-4 max-w-2xl px-4">
                  <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{error ? "WebContainer Error" : "Runtime Error"}</h3>
                    <p className="text-muted-foreground">{runtimeError || error}</p>
                  </div>
                  <div className="bg-black/90 rounded-2xl p-4 text-left">
                    <div className="flex items-center gap-2 mb-2 text-yellow-400">
                      <Terminal className="w-4 h-4" />
                      <span className="text-xs font-mono">Debug Info</span>
                    </div>
                    <div className="space-y-1 font-mono text-xs text-yellow-400 max-h-48 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  </div>
                  {!error && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Requirements:</p>
                      <ul className="text-sm text-left space-y-1 text-muted-foreground">
                        <li>• Use Chrome or Edge browser (recommended)</li>
                        <li>• Or deploy to enable Cross-Origin-Isolation headers</li>
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2 justify-center">
                    {onFixWithAI && (
                      <Button onClick={handleFixWithAI} className="gap-2 rounded-xl">
                        <Sparkles className="w-4 h-4" />
                        Fix with AI
                      </Button>
                    )}
                    <Button variant="outline" onClick={handleResetWebContainer} className="rounded-xl bg-transparent">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset WebContainer
                    </Button>
                    <Button variant="outline" onClick={downloadProject} className="rounded-xl bg-transparent">
                      Download Project
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab("code")} className="rounded-xl">
                      View Code
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {isBooting && !error && (
              <div className="flex-1 flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">Setting up WebContainer...</p>
                    <p className="text-sm text-muted-foreground">Installing dependencies and starting server</p>
                  </div>
                  {logs.length > 0 && (
                    <div className="max-w-2xl mx-auto bg-black/90 rounded-2xl p-4 text-left">
                      <div className="flex items-center gap-2 mb-2 text-green-400">
                        <Terminal className="w-4 h-4" />
                        <span className="text-xs font-mono">Terminal Output</span>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs text-green-400">
                        {logs.map((log, i) => (
                          <div key={i}>{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!isBooting && !error && previewUrl && (
              <iframe ref={iframeRef} src={previewUrl} className="w-full h-full border-0 bg-white" title="Preview" />
            )}
          </div>

          <div className={`h-full flex ${activeTab === "code" ? "" : "hidden"}`}>
            <div className="w-64 border-r border-border/40 bg-card/30 overflow-y-auto">
              <div className="p-4 space-y-1">
                {files.map((file) => (
                  <button
                    key={file}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-mono transition-colors ${
                      selectedFile === file ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
                    }`}
                  >
                    {file}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#0a0a0a] p-6">
              <pre className="text-sm font-mono">
                <code className="text-green-400">{code.files[selectedFile] || ""}</code>
              </pre>
            </div>
          </div>
        </div>

        {onModify && code?.files && (
          <div className="w-96 flex-shrink-0">
            <ModificationChat currentFiles={code.files} onModify={onModify} isModifying={isGenerating} />
          </div>
        )}
      </div>
    </div>
  )
}
