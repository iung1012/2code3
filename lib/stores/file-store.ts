import { create } from 'zustand';
import { logger } from '../logger';

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

export interface Folder {
  type: 'folder';
  isLocked?: boolean;
  lockedByFolder?: string;
}

export type Dirent = File | Folder;
export type FileMap = Record<string, Dirent | undefined>;

interface FileStore {
  files: FileMap;
  filesCount: number;
  modifiedFiles: Map<string, string>;
  deletedPaths: Set<string>;
  
  // Actions
  setFiles: (files: FileMap) => void;
  updateFile: (filePath: string, content: string) => void;
  createFile: (filePath: string, content: string) => void;
  deleteFile: (filePath: string) => void;
  createFolder: (folderPath: string) => void;
  deleteFolder: (folderPath: string) => void;
  
  // File operations
  getFile: (filePath: string) => File | undefined;
  getFileOrFolder: (filePath: string) => Dirent | undefined;
  getFileModifications: () => Record<string, { original: string; current: string }>;
  getModifiedFiles: () => FileMap;
  resetFileModifications: () => void;
  
  // Locking system
  lockFile: (filePath: string) => boolean;
  unlockFile: (filePath: string) => boolean;
  lockFolder: (folderPath: string) => boolean;
  unlockFolder: (folderPath: string) => boolean;
  isFileLocked: (filePath: string) => { locked: boolean; lockedBy?: string };
  isFolderLocked: (folderPath: string) => { isLocked: boolean; lockedBy?: string };
  
  // Cleanup
  cleanupDeletedFiles: () => void;
  reset: () => void;
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: {},
  filesCount: 0,
  modifiedFiles: new Map(),
  deletedPaths: new Set(),

  setFiles: (files) => {
    const filesCount = Object.values(files).filter(f => f?.type === 'file').length;
    set({ files, filesCount });
    logger.debug('Files updated', { count: filesCount });
  },

  updateFile: (filePath, content) => {
    const state = get();
    const currentFile = state.files[filePath];
    
    if (!currentFile || currentFile.type !== 'file') {
      logger.warn('Trying to update non-existent file', { filePath });
      return;
    }

    // Track modifications
    if (!state.modifiedFiles.has(filePath)) {
      state.modifiedFiles.set(filePath, currentFile.content);
    }

    const updatedFiles = {
      ...state.files,
      [filePath]: {
        ...currentFile,
        content,
      },
    };

    set({ files: updatedFiles });
    logger.debug('File updated', { filePath, contentLength: content.length });
  },

  createFile: (filePath, content) => {
    const state = get();
    const newFile: File = {
      type: 'file',
      content,
      isBinary: false,
      isLocked: false,
    };

    const updatedFiles = {
      ...state.files,
      [filePath]: newFile,
    };

    // Track as modification
    state.modifiedFiles.set(filePath, '');

    set({ 
      files: updatedFiles,
      filesCount: state.filesCount + 1,
    });
    
    logger.debug('File created', { filePath, contentLength: content.length });
  },

  deleteFile: (filePath) => {
    const state = get();
    const file = state.files[filePath];
    
    if (!file || file.type !== 'file') {
      logger.warn('Trying to delete non-existent file', { filePath });
      return;
    }

    const updatedFiles = { ...state.files };
    delete updatedFiles[filePath];

    // Remove from modifications
    state.modifiedFiles.delete(filePath);
    
    // Add to deleted paths
    const newDeletedPaths = new Set(state.deletedPaths);
    newDeletedPaths.add(filePath);

    set({ 
      files: updatedFiles,
      filesCount: state.filesCount - 1,
      deletedPaths: newDeletedPaths,
    });
    
    logger.debug('File deleted', { filePath });
  },

  createFolder: (folderPath) => {
    const state = get();
    const newFolder: Folder = {
      type: 'folder',
      isLocked: false,
    };

    const updatedFiles = {
      ...state.files,
      [folderPath]: newFolder,
    };

    set({ files: updatedFiles });
    logger.debug('Folder created', { folderPath });
  },

  deleteFolder: (folderPath) => {
    const state = get();
    const folder = state.files[folderPath];
    
    if (!folder || folder.type !== 'folder') {
      logger.warn('Trying to delete non-existent folder', { folderPath });
      return;
    }

    const updatedFiles = { ...state.files };
    const newDeletedPaths = new Set(state.deletedPaths);
    let filesToDelete = 0;

    // Remove folder and all its contents
    Object.keys(updatedFiles).forEach(path => {
      if (path === folderPath || path.startsWith(folderPath + '/')) {
        if (updatedFiles[path]?.type === 'file') {
          filesToDelete++;
          state.modifiedFiles.delete(path);
        }
        delete updatedFiles[path];
        newDeletedPaths.add(path);
      }
    });

    set({ 
      files: updatedFiles,
      filesCount: state.filesCount - filesToDelete,
      deletedPaths: newDeletedPaths,
    });
    
    logger.debug('Folder deleted', { folderPath, filesDeleted: filesToDelete });
  },

  getFile: (filePath) => {
    const state = get();
    const dirent = state.files[filePath];
    return dirent?.type === 'file' ? dirent : undefined;
  },

  getFileOrFolder: (filePath) => {
    const state = get();
    return state.files[filePath];
  },

  getFileModifications: () => {
    const state = get();
    const modifications: Record<string, { original: string; current: string }> = {};

    for (const [filePath, originalContent] of state.modifiedFiles) {
      const file = state.files[filePath];
      if (file?.type === 'file' && file.content !== originalContent) {
        modifications[filePath] = {
          original: originalContent,
          current: file.content,
        };
      }
    }

    return modifications;
  },

  getModifiedFiles: () => {
    const state = get();
    const modifiedFiles: FileMap = {};

    for (const [filePath, originalContent] of state.modifiedFiles) {
      const file = state.files[filePath];
      if (file?.type === 'file' && file.content !== originalContent) {
        modifiedFiles[filePath] = file;
      }
    }

    return modifiedFiles;
  },

  resetFileModifications: () => {
    set({ modifiedFiles: new Map() });
    logger.debug('File modifications reset');
  },

  lockFile: (filePath) => {
    const state = get();
    const file = state.files[filePath];
    
    if (!file || file.type !== 'file') {
      logger.warn('Cannot lock non-existent file', { filePath });
      return false;
    }

    const updatedFiles = {
      ...state.files,
      [filePath]: {
        ...file,
        isLocked: true,
      },
    };

    set({ files: updatedFiles });
    logger.debug('File locked', { filePath });
    return true;
  },

  unlockFile: (filePath) => {
    const state = get();
    const file = state.files[filePath];
    
    if (!file || file.type !== 'file') {
      logger.warn('Cannot unlock non-existent file', { filePath });
      return false;
    }

    const updatedFiles = {
      ...state.files,
      [filePath]: {
        ...file,
        isLocked: false,
        lockedByFolder: undefined,
      },
    };

    set({ files: updatedFiles });
    logger.debug('File unlocked', { filePath });
    return true;
  },

  lockFolder: (folderPath) => {
    const state = get();
    const folder = state.files[folderPath];
    
    if (!folder || folder.type !== 'folder') {
      logger.warn('Cannot lock non-existent folder', { folderPath });
      return false;
    }

    const updatedFiles = { ...state.files };
    
    // Lock the folder
    updatedFiles[folderPath] = {
      ...folder,
      isLocked: true,
    };

    // Lock all files within the folder
    Object.keys(updatedFiles).forEach(path => {
      if (path.startsWith(folderPath + '/') && updatedFiles[path]?.type === 'file') {
        updatedFiles[path] = {
          ...updatedFiles[path]!,
          isLocked: true,
          lockedByFolder: folderPath,
        };
      }
    });

    set({ files: updatedFiles });
    logger.debug('Folder locked', { folderPath });
    return true;
  },

  unlockFolder: (folderPath) => {
    const state = get();
    const folder = state.files[folderPath];
    
    if (!folder || folder.type !== 'folder') {
      logger.warn('Cannot unlock non-existent folder', { folderPath });
      return false;
    }

    const updatedFiles = { ...state.files };
    
    // Unlock the folder
    updatedFiles[folderPath] = {
      ...folder,
      isLocked: false,
    };

    // Unlock all files within the folder that were locked by this folder
    Object.keys(updatedFiles).forEach(path => {
      if (path.startsWith(folderPath + '/') && updatedFiles[path]?.type === 'file') {
        const file = updatedFiles[path]!;
        if (file.lockedByFolder === folderPath) {
          updatedFiles[path] = {
            ...file,
            isLocked: false,
            lockedByFolder: undefined,
          };
        }
      }
    });

    set({ files: updatedFiles });
    logger.debug('Folder unlocked', { folderPath });
    return true;
  },

  isFileLocked: (filePath) => {
    const state = get();
    const file = state.files[filePath];
    
    if (!file || file.type !== 'file') {
      return { locked: false };
    }

    if (file.isLocked) {
      return {
        locked: true,
        lockedBy: file.lockedByFolder || filePath,
      };
    }

    return { locked: false };
  },

  isFolderLocked: (folderPath) => {
    const state = get();
    const folder = state.files[folderPath];
    
    if (!folder || folder.type !== 'folder') {
      return { isLocked: false };
    }

    if (folder.isLocked) {
      return {
        isLocked: true,
        lockedBy: folderPath,
      };
    }

    return { isLocked: false };
  },

  cleanupDeletedFiles: () => {
    const state = get();
    if (state.deletedPaths.size === 0) return;

    const updatedFiles = { ...state.files };
    const pathsToDelete = new Set<string>();

    // Precompute prefixes for efficient checking
    const deletedPrefixes = [...state.deletedPaths].map(p => p + '/');

    // Iterate through all current files/folders
    for (const [path, dirent] of Object.entries(updatedFiles)) {
      if (!dirent) continue;

      // Check for exact match
      if (state.deletedPaths.has(path)) {
        pathsToDelete.add(path);
        continue;
      }

      // Check if path starts with any deleted folder prefix
      for (const prefix of deletedPrefixes) {
        if (path.startsWith(prefix)) {
          pathsToDelete.add(path);
          break;
        }
      }
    }

    // Perform deletions
    if (pathsToDelete.size > 0) {
      let filesDeleted = 0;
      
      for (const pathToDelete of pathsToDelete) {
        const dirent = updatedFiles[pathToDelete];
        delete updatedFiles[pathToDelete];

        if (dirent?.type === 'file') {
          filesDeleted++;
          state.modifiedFiles.delete(pathToDelete);
        }
      }

      set({ 
        files: updatedFiles,
        filesCount: state.filesCount - filesDeleted,
      });
      
      logger.debug('Cleaned up deleted files', { pathsDeleted: pathsToDelete.size, filesDeleted });
    }
  },

  reset: () => {
    set({
      files: {},
      filesCount: 0,
      modifiedFiles: new Map(),
      deletedPaths: new Set(),
    });
    logger.debug('File store reset');
  },
}));
