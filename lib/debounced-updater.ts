export interface UpdateBatch {
  files: Record<string, string>;
  commands: string[];
  timestamp: number;
  id: string;
}

export interface DebouncedUpdaterOptions {
  delay: number;
  maxBatchSize: number;
  onBatchReady: (batch: UpdateBatch) => Promise<void>;
}

export class DebouncedUpdater {
  private pendingFiles: Record<string, string> = {};
  private pendingCommands: string[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private options: DebouncedUpdaterOptions;
  private isProcessing = false;

  constructor(options: DebouncedUpdaterOptions) {
    this.options = options;
  }

  addFile(path: string, content: string): void {
    this.pendingFiles[path] = content;
    this.scheduleUpdate();
  }

  addCommand(command: string): void {
    this.pendingCommands.push(command);
    this.scheduleUpdate();
  }

  private scheduleUpdate(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.processBatch();
    }, this.options.delay);
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessing || Object.keys(this.pendingFiles).length === 0 && this.pendingCommands.length === 0) {
      return;
    }

    this.isProcessing = true;

    const batch: UpdateBatch = {
      files: { ...this.pendingFiles },
      commands: [...this.pendingCommands],
      timestamp: Date.now(),
      id: this.generateId()
    };

    // Limpa pendências
    this.pendingFiles = {};
    this.pendingCommands = [];

    try {
      await this.options.onBatchReady(batch);
      console.log(`[DebouncedUpdater] Processed batch ${batch.id} with ${Object.keys(batch.files).length} files and ${batch.commands.length} commands`);
    } catch (error) {
      console.error(`[DebouncedUpdater] Batch ${batch.id} failed:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Força processamento imediato
  async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    await this.processBatch();
  }

  // Verifica se há atualizações pendentes
  hasPendingUpdates(): boolean {
    return Object.keys(this.pendingFiles).length > 0 || this.pendingCommands.length > 0;
  }

  // Obtém estatísticas das atualizações pendentes
  getPendingStats(): {
    fileCount: number;
    commandCount: number;
    totalSize: number;
  } {
    const fileCount = Object.keys(this.pendingFiles).length;
    const commandCount = this.pendingCommands.length;
    const totalSize = Object.values(this.pendingFiles).reduce((sum, content) => sum + content.length, 0);

    return { fileCount, commandCount, totalSize };
  }

  private generateId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Instância global para o projeto
export const debouncedUpdater = new DebouncedUpdater({
  delay: 500, // 500ms de delay
  maxBatchSize: 10,
  onBatchReady: async (batch) => {
    console.log(`[DebouncedUpdater] Processing batch:`, batch);
    
    // Aqui você integraria com o sistema de arquivos e comandos
    // Por exemplo:
    // - Atualizar arquivos no WebContainer
    // - Executar comandos na fila
    // - Sincronizar com o estado global
  }
});
