export interface Command {
  id: string;
  command: string;
  type: 'install' | 'build' | 'dev' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  timestamp: number;
  duration?: number;
}

export interface CommandQueueOptions {
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number;
}

export class CommandQueue {
  private queue: Command[] = [];
  private running: Command[] = [];
  private completed: Command[] = [];
  private options: CommandQueueOptions;
  private isProcessing = false;

  constructor(options: Partial<CommandQueueOptions> = {}) {
    this.options = {
      maxConcurrent: 2,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
  }

  addCommand(command: string, type: Command['type'] = 'custom'): string {
    const cmd: Command = {
      id: this.generateId(),
      command,
      type,
      status: 'pending',
      timestamp: Date.now()
    };

    this.queue.push(cmd);
    this.processQueue();
    
    return cmd.id;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.running.length >= this.options.maxConcurrent) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && this.running.length < this.options.maxConcurrent) {
      const command = this.queue.shift();
      if (command) {
        this.running.push(command);
        this.executeCommand(command);
      }
    }

    this.isProcessing = false;
  }

  private async executeCommand(command: Command): Promise<void> {
    command.status = 'running';
    const startTime = performance.now();

    try {
      // Simula execução de comando (aqui você integraria com WebContainer)
      const output = await this.simulateCommandExecution(command.command);
      
      command.status = 'completed';
      command.output = output;
      command.duration = performance.now() - startTime;

      console.log(`[CommandQueue] Completed: ${command.command} (${command.duration.toFixed(2)}ms)`);
    } catch (error) {
      command.status = 'failed';
      command.error = error.message;
      command.duration = performance.now() - startTime;

      console.error(`[CommandQueue] Failed: ${command.command}`, error);
    }

    // Move para completed e remove do running
    this.completed.push(command);
    this.running = this.running.filter(c => c.id !== command.id);

    // Processa próxima fila
    this.processQueue();
  }

  private async simulateCommandExecution(command: string): Promise<string> {
    // Simula delay baseado no tipo de comando
    const delays = {
      'npm install': 2000,
      'npm run build': 1500,
      'npm run dev': 1000,
      'custom': 500
    };

    const delay = delays[this.getCommandType(command)] || delays.custom;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simula output baseado no comando
    if (command.includes('install')) {
      return `Installing dependencies...\nadded 150 packages in 2s`;
    } else if (command.includes('build')) {
      return `Building project...\n✓ Build completed successfully`;
    } else if (command.includes('dev')) {
      return `Starting development server...\n✓ Server running on http://localhost:3000`;
    }

    return `Executed: ${command}`;
  }

  private getCommandType(command: string): keyof typeof delays {
    if (command.includes('install')) return 'npm install';
    if (command.includes('build')) return 'npm run build';
    if (command.includes('dev')) return 'npm run dev';
    return 'custom';
  }

  getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    return {
      pending: this.queue.length,
      running: this.running.length,
      completed: this.completed.length,
      failed: this.completed.filter(c => c.status === 'failed').length
    };
  }

  getRunningCommands(): Command[] {
    return [...this.running];
  }

  getCompletedCommands(): Command[] {
    return [...this.completed].reverse(); // Mais recentes primeiro
  }

  getCommandById(id: string): Command | undefined {
    return [...this.queue, ...this.running, ...this.completed].find(c => c.id === id);
  }

  clearCompleted(): void {
    this.completed = [];
  }

  retryCommand(id: string): void {
    const command = this.completed.find(c => c.id === id && c.status === 'failed');
    if (command) {
      command.status = 'pending';
      command.error = undefined;
      this.queue.push(command);
      this.completed = this.completed.filter(c => c.id !== id);
      this.processQueue();
    }
  }

  private generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Método para integrar com WebContainer
  async executeInWebContainer(command: string, webContainer: any): Promise<string> {
    try {
      const process = await webContainer.spawn('bash', ['-c', command]);
      
      let output = '';
      process.output.pipeTo(new WritableStream({
        write(chunk) {
          output += new TextDecoder().decode(chunk);
        }
      }));

      const exitCode = await process.exit;
      
      if (exitCode !== 0) {
        throw new Error(`Command failed with exit code ${exitCode}`);
      }

      return output;
    } catch (error) {
      throw new Error(`WebContainer execution failed: ${error.message}`);
    }
  }
}

export const commandQueue = new CommandQueue();
