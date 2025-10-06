export interface ParsedAction {
  type: 'file' | 'shell';
  filePath?: string;
  content: string;
  id: string;
}

export interface ParsedArtifact {
  id: string;
  title: string;
  actions: ParsedAction[];
}

export interface ParserCallbacks {
  onActionStream?: (action: ParsedAction) => void;
  onArtifactComplete?: (artifact: ParsedArtifact) => void;
}

export class StreamingParser {
  private messages = new Map<string, {
    position: number;
    insideArtifact: boolean;
    insideAction: boolean;
    currentArtifact: ParsedArtifact | null;
    currentAction: ParsedAction | null;
    actionId: number;
  }>();

  constructor(private callbacks?: ParserCallbacks) {}

  parse(messageId: string, input: string): void {
    let state = this.messages.get(messageId);
    
    if (!state) {
      state = {
        position: 0,
        insideArtifact: false,
        insideAction: false,
        currentArtifact: null,
        currentAction: null,
        actionId: 0
      };
      this.messages.set(messageId, state);
    }

    // Processa apenas o novo conteúdo
    const newContent = input.slice(state.position);
    state.position = input.length;

    // Regex patterns
    const patterns = {
      artifactOpen: /<boltArtifact[^>]*id="([^"]*)"[^>]*title="([^"]*)"[^>]*>/g,
      artifactClose: /<\/boltArtifact>/g,
      actionOpen: /<boltAction[^>]*type="([^"]*)"[^>]*(?:filePath="([^"]*)")?[^>]*>/g,
      actionClose: /<\/boltAction>/g
    };

    let match;
    
    // Processa artifact open
    while ((match = patterns.artifactOpen.exec(newContent)) !== null) {
      const [, id, title] = match;
      state.insideArtifact = true;
      state.currentArtifact = {
        id,
        title,
        actions: []
      };
    }

    // Processa action open
    while ((match = patterns.actionOpen.exec(newContent)) !== null) {
      const [, type, filePath] = match;
      state.insideAction = true;
      state.actionId++;
      state.currentAction = {
        type: type as 'file' | 'shell',
        filePath,
        content: '',
        id: `${messageId}-${state.actionId}`
      };
    }

    // Processa action close
    while ((match = patterns.actionClose.exec(newContent)) !== null) {
      if (state.insideAction && state.currentAction) {
        // Chama callback para processar ação
        this.callbacks?.onActionStream?.(state.currentAction);
        
        // Adiciona à lista de ações do artifact
        if (state.currentArtifact) {
          state.currentArtifact.actions.push(state.currentAction);
        }
        
        state.insideAction = false;
        state.currentAction = null;
      }
    }

    // Processa artifact close
    while ((match = patterns.artifactClose.exec(newContent)) !== null) {
      if (state.insideArtifact && state.currentArtifact) {
        // Chama callback para artifact completo
        this.callbacks?.onArtifactComplete?.(state.currentArtifact);
        
        state.insideArtifact = false;
        state.currentArtifact = null;
      }
    }

    // Se estamos dentro de uma ação, acumula conteúdo
    if (state.insideAction && state.currentAction) {
      // Encontra o próximo action close
      const nextActionClose = newContent.indexOf('</boltAction>');
      if (nextActionClose !== -1) {
        const content = newContent.slice(0, nextActionClose);
        state.currentAction.content += content;
      } else {
        // Ainda não terminou, acumula tudo
        state.currentAction.content += newContent;
      }
    }
  }

  clear(messageId: string): void {
    this.messages.delete(messageId);
  }
}
