import { logger } from './logger';

export interface ParsedContent {
  type: 'file' | 'command' | 'text';
  content: string;
  filePath?: string;
  language?: string;
  artifactId?: string;
}

export class EnhancedMessageParser {
  private processedBlocks = new Map<string, Set<string>>();
  private artifactCounter = 0;

  // Padrões otimizados para detecção de comandos
  private commandPatterns = new Map<string, RegExp>([
    ['npm', /^(npm|yarn|pnpm)\s+(install|run|start|build|dev|test|init|create|add|remove)/],
    ['git', /^(git)\s+(add|commit|push|pull|clone|status|checkout|branch|merge|rebase|init|remote|fetch|log)/],
    ['docker', /^(docker|docker-compose)\s+/],
    ['build', /^(make|cmake|gradle|mvn|cargo|go)\s+/],
    ['network', /^(curl|wget|ping|ssh|scp|rsync)\s+/],
    ['webcontainer', /^(cat|chmod|cp|echo|hostname|kill|ln|ls|mkdir|mv|ps|pwd|rm|rmdir|xxd)\s*/],
    ['interpreters', /^(node|python|python3|java|go|rust|ruby|php|perl)\s+/],
    ['text-processing', /^(grep|sed|awk|cut|tr|sort|uniq|wc|diff)\s+/],
    ['archive', /^(tar|zip|unzip|gzip|gunzip)\s+/],
    ['process', /^(ps|top|htop|kill|killall|jobs|nohup)\s*/],
    ['system', /^(df|du|free|uname|whoami|id|groups|date|uptime)\s*/],
  ]);

  parse(messageId: string, input: string): ParsedContent[] {
    logger.debug('Parsing message', { messageId, inputLength: input.length });
    
    const results: ParsedContent[] = [];
    
    // Inicializar blocos processados para esta mensagem
    if (!this.processedBlocks.has(messageId)) {
      this.processedBlocks.set(messageId, new Set());
    }
    
    const processed = this.processedBlocks.get(messageId)!;
    
    // Detectar e processar blocos de código
    const codeBlocks = this.detectCodeBlocks(input);
    
    for (const block of codeBlocks) {
      const blockHash = this.hashBlock(block.match);
      
      if (processed.has(blockHash)) {
        continue;
      }
      
      processed.add(blockHash);
      
      // Determinar se é arquivo ou comando
      const parsed = this.classifyBlock(block, messageId);
      if (parsed) {
        results.push(parsed);
      }
    }
    
    // Detectar operações de arquivo sem blocos de código
    const fileOperations = this.detectFileOperations(input);
    for (const operation of fileOperations) {
      const blockHash = this.hashBlock(operation.match);
      
      if (processed.has(blockHash)) {
        continue;
      }
      
      processed.add(blockHash);
      
      const parsed = this.parseFileOperation(operation, messageId);
      if (parsed) {
        results.push(parsed);
      }
    }
    
    logger.debug('Parsing complete', { resultsCount: results.length });
    return results;
  }

  private detectCodeBlocks(input: string) {
    const patterns = [
      // Padrão 1: Caminho de arquivo seguido por bloco de código
      {
        regex: /(?:^|\n)([\/\w\-\.]+\.\w+):?\s*\n+```(\w*)\n([\s\S]*?)```/gim,
        type: 'file_path',
      },
      // Padrão 2: Menções explícitas de criação de arquivo
      {
        regex: /(?:create|update|modify|edit|write|add|generate|here'?s?|file:?)\s+(?:a\s+)?(?:new\s+)?(?:file\s+)?(?:called\s+)?[`'"]*([\/\w\-\.]+\.\w+)[`'"]*:?\s*\n+```(\w*)\n([\s\S]*?)```/gi,
        type: 'explicit_create',
      },
      // Padrão 3: Blocos de código com comentários de nome de arquivo
      {
        regex: /```(\w*)\n(?:\/\/|#|<!--)\s*(?:file:?|filename:?)\s*([\/\w\-\.]+\.\w+).*?\n([\s\S]*?)```/gi,
        type: 'comment_filename',
      },
      // Padrão 4: Bloco de código com contexto "in <filename>"
      {
        regex: /(?:in|for|update)\s+[`'"]*([\/\w\-\.]+\.\w+)[`'"]*:?\s*\n+```(\w*)\n([\s\S]*?)```/gi,
        type: 'in_filename',
      },
      // Padrão 5: Arquivos estruturados (package.json, componentes)
      {
        regex: /```(?:json|jsx?|tsx?|html?|vue|svelte)\n(\{[\s\S]*?"(?:name|version|scripts|dependencies|devDependencies)"[\s\S]*?\}|<\w+[^>]*>[\s\S]*?<\/\w+>[\s\S]*?)```/gi,
        type: 'structured_file',
      },
    ];

    const blocks: Array<{
      match: string;
      type: string;
      filePath?: string;
      language?: string;
      content?: string;
    }> = [];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(input)) !== null) {
        let filePath: string;
        let language: string;
        let content: string;

        if (pattern.type === 'comment_filename') {
          [, language, filePath, content] = match;
        } else if (pattern.type === 'structured_file') {
          content = match[1];
          language = pattern.regex.source.includes('json') ? 'json' : 'jsx';
          filePath = this.inferFileNameFromContent(content, language);
        } else {
          [filePath, language, content] = match.slice(1);
        }

        blocks.push({
          match: match[0],
          type: pattern.type,
          filePath: this.normalizeFilePath(filePath),
          language,
          content,
        });
      }
    }

    return blocks;
  }

  private detectFileOperations(input: string) {
    const pattern = /(?:create|write|save|generate)\s+(?:a\s+)?(?:new\s+)?file\s+(?:at\s+)?[`'"]*([\/\w\-\.]+\.\w+)[`'"]*\s+with\s+(?:the\s+)?(?:following\s+)?content:?\s*\n([\s\S]+?)(?=\n\n|\n(?:create|write|save|generate|now|next|then|finally)|$)/gi;
    
    const operations: Array<{
      match: string;
      filePath: string;
      content: string;
    }> = [];

    let match;
    while ((match = pattern.exec(input)) !== null) {
      operations.push({
        match: match[0],
        filePath: this.normalizeFilePath(match[1]),
        content: match[2].trim(),
      });
    }

    return operations;
  }

  private classifyBlock(block: any, messageId: string): ParsedContent | null {
    const { filePath, language, content } = block;

    // Verificar se é um comando shell
    if (this.isShellCommand(content, language)) {
      logger.debug('Detected shell command', { content: content.substring(0, 100) });
      return {
        type: 'command',
        content: content.trim(),
        artifactId: `command-${messageId}-${this.artifactCounter++}`,
      };
    }

    // Verificar se é um arquivo válido
    if (this.isValidFilePath(filePath)) {
      logger.debug('Detected file', { filePath, language });
      return {
        type: 'file',
        content,
        filePath,
        language,
        artifactId: `file-${messageId}-${this.artifactCounter++}`,
      };
    }

    return null;
  }

  private parseFileOperation(operation: any, messageId: string): ParsedContent | null {
    const { filePath, content } = operation;

    if (this.isValidFilePath(filePath)) {
      logger.debug('Detected file operation', { filePath });
      return {
        type: 'file',
        content,
        filePath,
        artifactId: `file-${messageId}-${this.artifactCounter++}`,
      };
    }

    return null;
  }

  private isShellCommand(content: string, language: string): boolean {
    const shellLanguages = ['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'ps1'];
    const isShellLang = shellLanguages.includes(language?.toLowerCase());

    if (!isShellLang) {
      return false;
    }

    const trimmedContent = content.trim();
    const lines = trimmedContent
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return false;
    }

    // Verificar se parece conteúdo de script (NÃO deve ser tratado como comandos)
    if (this.looksLikeScriptContent(trimmedContent)) {
      return false;
    }

    // Comandos de linha única são provavelmente para execução
    if (lines.length === 1) {
      return this.isSingleLineCommand(lines[0]);
    }

    // Multi-linha: verificar se é uma sequência de comandos
    return this.isCommandSequence(lines);
  }

  private isSingleLineCommand(line: string): boolean {
    // Verificar cadeias de comandos com &&, ||, |, ;
    const hasChaining = /[;&|]{1,2}/.test(line);

    if (hasChaining) {
      const parts = line.split(/[;&|]{1,2}/).map(p => p.trim());
      return parts.every(part => part.length > 0 && !this.looksLikeScriptContent(part));
    }

    // Verificar padrões de prefixo de comando
    const prefixPatterns = [
      /^sudo\s+/,
      /^time\s+/,
      /^nohup\s+/,
      /^watch\s+/,
      /^env\s+\w+=\w+\s+/,
    ];

    let cleanLine = line;
    for (const prefix of prefixPatterns) {
      cleanLine = cleanLine.replace(prefix, '');
    }

    // Verificação otimizada usando Map
    for (const [, pattern] of this.commandPatterns) {
      if (pattern.test(cleanLine)) {
        return true;
      }
    }

    return this.isSimpleCommand(cleanLine);
  }

  private isCommandSequence(lines: string[]): boolean {
    const commandLikeLines = lines.filter(
      line => line.length > 0 && 
      !line.startsWith('#') && 
      (this.isSingleLineCommand(line) || this.isSimpleCommand(line))
    );

    return commandLikeLines.length / lines.length > 0.7;
  }

  private isSimpleCommand(line: string): boolean {
    const words = line.split(/\s+/);
    if (words.length === 0) return false;

    const firstWord = words[0];

    // Não tratar atribuições de variáveis como comandos
    if (line.includes('=') && !line.startsWith('export ') && !line.startsWith('env ') && !firstWord.includes('=')) {
      return false;
    }

    // Não tratar definições de função como comandos
    if (line.includes('function ') || line.match(/^\w+\s*\(\s*\)/)) {
      return false;
    }

    // Não tratar estruturas de controle como comandos
    if (/^(if|for|while|case|function|until|select)\s/.test(line)) {
      return false;
    }

    // Padrões de comando simples
    const commandLikePatterns = [
      /^[a-z][a-z0-9-_]*$/i,
      /^\.\/[a-z0-9-_./]+$/i,
      /^\/[a-z0-9-_./]+$/i,
      /^[a-z][a-z0-9-_]*\s+-.+/i,
    ];

    return commandLikePatterns.some(pattern => pattern.test(firstWord));
  }

  private looksLikeScriptContent(content: string): boolean {
    const lines = content.trim().split('\n');

    const scriptIndicators = [
      /^#!/,
      /function\s+\w+/,
      /^\w+\s*\(\s*\)\s*\{/,
      /^(if|for|while|case)\s+.*?(then|do|in)/,
      /^\w+=[^=].*$/,
      /^(local|declare|readonly)\s+/,
      /^(source|\.)\s+/,
      /^(exit|return)\s+\d+/,
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
        continue;
      }

      if (scriptIndicators.some(pattern => pattern.test(trimmedLine))) {
        return true;
      }
    }

    return false;
  }

  private isValidFilePath(filePath: string): boolean {
    if (!filePath) return false;

    // Verificar extensão válida
    const hasExtension = /\.\w+$/.test(filePath);
    if (!hasExtension) return false;

    // Verificar caracteres válidos
    const isValid = /^[\/\w\-\.]+$/.test(filePath);
    if (!isValid) return false;

    // Excluir padrões que provavelmente não são arquivos reais
    const excludePatterns = [
      /^\/?(tmp|temp|test|example)\//i,
      /\.(tmp|temp|bak|backup|old|orig)$/i,
      /^\/?(output|result|response)\//i,
      /^code_\d+\.(sh|bash|zsh)$/i,
      /^(untitled|new|demo|sample)\d*\./i,
    ];

    return !excludePatterns.some(pattern => pattern.test(filePath));
  }

  private normalizeFilePath(filePath: string): string {
    // Remover aspas, backticks e limpar
    filePath = filePath.replace(/[`'"]/g, '').trim();

    // Garantir barras para frente
    filePath = filePath.replace(/\\/g, '/');

    // Remover ./ inicial se presente
    if (filePath.startsWith('./')) {
      filePath = filePath.substring(2);
    }

    // Adicionar barra inicial se faltando e não for caminho relativo
    if (!filePath.startsWith('/') && !filePath.startsWith('.')) {
      filePath = '/' + filePath;
    }

    return filePath;
  }

  private inferFileNameFromContent(content: string, language: string): string {
    // Tentar inferir nome do componente do conteúdo
    const componentMatch = content.match(
      /(?:function|class|const|export\s+default\s+function|export\s+function)\s+(\w+)/
    );

    if (componentMatch) {
      const name = componentMatch[1];
      const ext = language === 'jsx' ? '.jsx' : language === 'tsx' ? '.tsx' : '.js';
      return `/components/${name}${ext}`;
    }

    // Verificar componente App
    if (content.includes('function App') || content.includes('const App')) {
      return '/App.jsx';
    }

    // Padrão para package.json
    if (language === 'json' && content.includes('"name"')) {
      return '/package.json';
    }

    // Padrão para arquivos HTML
    if (language === 'html' && content.includes('<html')) {
      return '/index.html';
    }

    // Padrão para arquivos CSS
    if (language === 'css' && content.includes('{')) {
      return '/styles.css';
    }

    // Padrão genérico
    return `/component-${Date.now()}.jsx`;
  }

  private hashBlock(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  reset() {
    this.processedBlocks.clear();
    this.artifactCounter = 0;
  }
}

export const enhancedMessageParser = new EnhancedMessageParser();
