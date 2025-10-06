import { create } from 'zustand';
import { logger } from '../logger';
import type { FileMap } from './file-store';

export interface EditorDocument {
  filePath: string;
  value: string;
  language?: string;
  scrollPosition?: { line: number; column: number };
}

export interface ScrollPosition {
  line: number;
  column: number;
}

interface EditorStore {
  documents: Record<string, EditorDocument>;
  selectedFile: string | undefined;
  currentDocument: EditorDocument | undefined;
  
  // Actions
  setDocuments: (files: FileMap) => void;
  setSelectedFile: (filePath: string | undefined) => void;
  updateFile: (filePath: string, content: string) => void;
  updateScrollPosition: (filePath: string, position: ScrollPosition) => void;
  getDocument: (filePath: string) => EditorDocument | undefined;
  reset: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  documents: {},
  selectedFile: undefined,
  currentDocument: undefined,

  setDocuments: (files) => {
    const documents: Record<string, EditorDocument> = {};
    
    // Convert files to editor documents
    Object.entries(files).forEach(([filePath, dirent]) => {
      if (dirent?.type === 'file') {
        documents[filePath] = {
          filePath,
          value: dirent.content,
          language: getLanguageFromPath(filePath),
        };
      }
    });

    set({ documents });
    
    // Auto-select first file if none selected
    const state = get();
    if (!state.selectedFile && Object.keys(documents).length > 0) {
      const firstFile = Object.keys(documents)[0];
      state.setSelectedFile(firstFile);
    }
    
    logger.debug('Documents updated', { count: Object.keys(documents).length });
  },

  setSelectedFile: (filePath) => {
    const state = get();
    const document = filePath ? state.documents[filePath] : undefined;
    
    set({ 
      selectedFile: filePath,
      currentDocument: document,
    });
    
    logger.debug('Selected file changed', { filePath });
  },

  updateFile: (filePath, content) => {
    const state = get();
    const document = state.documents[filePath];
    
    if (!document) {
      logger.warn('Trying to update non-existent document', { filePath });
      return;
    }

    const updatedDocuments = {
      ...state.documents,
      [filePath]: {
        ...document,
        value: content,
      },
    };

    set({ documents: updatedDocuments });
    
    // Update current document if it's the selected file
    if (state.selectedFile === filePath) {
      set({ 
        currentDocument: updatedDocuments[filePath],
      });
    }
    
    logger.debug('Document updated', { filePath, contentLength: content.length });
  },

  updateScrollPosition: (filePath, position) => {
    const state = get();
    const document = state.documents[filePath];
    
    if (!document) {
      logger.warn('Trying to update scroll position for non-existent document', { filePath });
      return;
    }

    const updatedDocuments = {
      ...state.documents,
      [filePath]: {
        ...document,
        scrollPosition: position,
      },
    };

    set({ documents: updatedDocuments });
    
    // Update current document if it's the selected file
    if (state.selectedFile === filePath) {
      set({ 
        currentDocument: updatedDocuments[filePath],
      });
    }
    
    logger.debug('Scroll position updated', { filePath, position });
  },

  getDocument: (filePath) => {
    const state = get();
    return state.documents[filePath];
  },

  reset: () => {
    set({
      documents: {},
      selectedFile: undefined,
      currentDocument: undefined,
    });
    logger.debug('Editor store reset');
  },
}));

function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'sql': 'sql',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'fish',
    'ps1': 'powershell',
    'dockerfile': 'dockerfile',
    'gitignore': 'gitignore',
    'env': 'properties',
  };

  return languageMap[extension || ''] || 'text';
}
