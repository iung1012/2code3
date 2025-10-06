import { create } from 'zustand';
import { logger } from '../logger';
import { useFileStore } from './file-store';
import { useEditorStore } from './editor-store';

export interface Artifact {
  id: string;
  title: string;
  type?: string;
  closed: boolean;
  files: Record<string, string>;
  createdAt: Date;
}

export type WorkbenchViewType = 'code' | 'preview' | 'files';

interface WorkbenchStore {
  // State
  showWorkbench: boolean;
  currentView: WorkbenchViewType;
  artifacts: Record<string, Artifact>;
  artifactIdList: string[];
  unsavedFiles: Set<string>;
  
  // Actions
  setShowWorkbench: (show: boolean) => void;
  setCurrentView: (view: WorkbenchViewType) => void;
  addArtifact: (artifact: Omit<Artifact, 'createdAt'>) => void;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  closeArtifact: (id: string) => void;
  removeArtifact: (id: string) => void;
  
  // File operations
  saveFile: (filePath: string) => Promise<void>;
  saveCurrentDocument: () => Promise<void>;
  saveAllFiles: () => Promise<void>;
  resetCurrentDocument: () => void;
  
  // Computed
  firstArtifact: Artifact | undefined;
  activeArtifact: Artifact | undefined;
  hasUnsavedChanges: boolean;
  
  // Reset
  reset: () => void;
}

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  showWorkbench: false,
  currentView: 'code',
  artifacts: {},
  artifactIdList: [],
  unsavedFiles: new Set(),

  setShowWorkbench: (show) => {
    set({ showWorkbench: show });
    logger.debug('Workbench visibility changed', { show });
  },

  setCurrentView: (view) => {
    set({ currentView: view });
    logger.debug('Current view changed', { view });
  },

  addArtifact: (artifact) => {
    const state = get();
    const newArtifact: Artifact = {
      ...artifact,
      createdAt: new Date(),
    };

    const updatedArtifacts = {
      ...state.artifacts,
      [artifact.id]: newArtifact,
    };

    const updatedIdList = state.artifactIdList.includes(artifact.id)
      ? state.artifactIdList
      : [...state.artifactIdList, artifact.id];

    set({ 
      artifacts: updatedArtifacts,
      artifactIdList: updatedIdList,
    });
    
    logger.debug('Artifact added', { id: artifact.id, title: artifact.title });
  },

  updateArtifact: (id, updates) => {
    const state = get();
    const artifact = state.artifacts[id];
    
    if (!artifact) {
      logger.warn('Trying to update non-existent artifact', { id });
      return;
    }

    const updatedArtifacts = {
      ...state.artifacts,
      [id]: {
        ...artifact,
        ...updates,
      },
    };

    set({ artifacts: updatedArtifacts });
    logger.debug('Artifact updated', { id, updates });
  },

  closeArtifact: (id) => {
    const state = get();
    const artifact = state.artifacts[id];
    
    if (!artifact) {
      logger.warn('Trying to close non-existent artifact', { id });
      return;
    }

    const updatedArtifacts = {
      ...state.artifacts,
      [id]: {
        ...artifact,
        closed: true,
      },
    };

    set({ artifacts: updatedArtifacts });
    logger.debug('Artifact closed', { id });
  },

  removeArtifact: (id) => {
    const state = get();
    const artifact = state.artifacts[id];
    
    if (!artifact) {
      logger.warn('Trying to remove non-existent artifact', { id });
      return;
    }

    const updatedArtifacts = { ...state.artifacts };
    delete updatedArtifacts[id];

    const updatedIdList = state.artifactIdList.filter(artifactId => artifactId !== id);

    set({ 
      artifacts: updatedArtifacts,
      artifactIdList: updatedIdList,
    });
    
    logger.debug('Artifact removed', { id });
  },

  saveFile: async (filePath) => {
    const state = get();
    const fileStore = useFileStore.getState();
    const editorStore = useEditorStore.getState();
    
    const document = editorStore.getDocument(filePath);
    if (!document) {
      logger.warn('Trying to save non-existent document', { filePath });
      return;
    }

    // Update file in file store
    fileStore.updateFile(filePath, document.value);
    
    // Remove from unsaved files
    const newUnsavedFiles = new Set(state.unsavedFiles);
    newUnsavedFiles.delete(filePath);
    
    set({ unsavedFiles: newUnsavedFiles });
    logger.debug('File saved', { filePath });
  },

  saveCurrentDocument: async () => {
    const editorStore = useEditorStore.getState();
    const currentDocument = editorStore.currentDocument;
    
    if (!currentDocument) {
      logger.warn('No current document to save');
      return;
    }

    const state = get();
    await state.saveFile(currentDocument.filePath);
  },

  saveAllFiles: async () => {
    const state = get();
    const editorStore = useEditorStore.getState();
    
    const savePromises = Array.from(state.unsavedFiles).map(filePath => {
      const document = editorStore.getDocument(filePath);
      if (document) {
        return state.saveFile(filePath);
      }
    });

    await Promise.all(savePromises);
    logger.debug('All files saved');
  },

  resetCurrentDocument: () => {
    const editorStore = useEditorStore.getState();
    const fileStore = useFileStore.getState();
    const currentDocument = editorStore.currentDocument;
    
    if (!currentDocument) {
      logger.warn('No current document to reset');
      return;
    }

    const file = fileStore.getFile(currentDocument.filePath);
    if (file) {
      editorStore.updateFile(currentDocument.filePath, file.content);
      
      // Remove from unsaved files
      const state = get();
      const newUnsavedFiles = new Set(state.unsavedFiles);
      newUnsavedFiles.delete(currentDocument.filePath);
      set({ unsavedFiles: newUnsavedFiles });
      
      logger.debug('Current document reset', { filePath: currentDocument.filePath });
    }
  },

  get firstArtifact() {
    const state = get();
    return state.artifactIdList.length > 0 
      ? state.artifacts[state.artifactIdList[0]]
      : undefined;
  },

  get activeArtifact() {
    const state = get();
    const activeId = state.artifactIdList.find(id => !state.artifacts[id]?.closed);
    return activeId ? state.artifacts[activeId] : undefined;
  },

  get hasUnsavedChanges() {
    const state = get();
    return state.unsavedFiles.size > 0;
  },

  reset: () => {
    set({
      showWorkbench: false,
      currentView: 'code',
      artifacts: {},
      artifactIdList: [],
      unsavedFiles: new Set(),
    });
    logger.debug('Workbench store reset');
  },
}));
