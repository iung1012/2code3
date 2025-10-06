export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  timestamp: number;
}

export interface ProjectSnapshot {
  id: string;
  timestamp: number;
  files: Record<string, string>;
  changes: FileChange[];
}

export class DiffTracker {
  private snapshots: ProjectSnapshot[] = [];
  private currentSnapshot: ProjectSnapshot | null = null;
  private maxSnapshots = 50;

  createSnapshot(files: Record<string, string>): ProjectSnapshot {
    const snapshot: ProjectSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      files: { ...files },
      changes: []
    };

    // Calcula mudanças se há snapshot anterior
    if (this.currentSnapshot) {
      snapshot.changes = this.calculateChanges(this.currentSnapshot.files, files);
    }

    this.snapshots.push(snapshot);
    this.currentSnapshot = snapshot;

    // Mantém apenas os últimos snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    return snapshot;
  }

  private calculateChanges(oldFiles: Record<string, string>, newFiles: Record<string, string>): FileChange[] {
    const changes: FileChange[] = [];
    const allPaths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);

    for (const path of allPaths) {
      const oldContent = oldFiles[path];
      const newContent = newFiles[path];

      if (!oldContent && newContent) {
        // Arquivo criado
        changes.push({
          path,
          type: 'created',
          newContent,
          timestamp: Date.now()
        });
      } else if (oldContent && !newContent) {
        // Arquivo deletado
        changes.push({
          path,
          type: 'deleted',
          oldContent,
          timestamp: Date.now()
        });
      } else if (oldContent && newContent && oldContent !== newContent) {
        // Arquivo modificado
        changes.push({
          path,
          type: 'modified',
          oldContent,
          newContent,
          timestamp: Date.now()
        });
      }
    }

    return changes;
  }

  getChanges(snapshotId: string): FileChange[] {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    return snapshot?.changes || [];
  }

  getSnapshotHistory(): ProjectSnapshot[] {
    return [...this.snapshots].reverse(); // Mais recentes primeiro
  }

  getCurrentSnapshot(): ProjectSnapshot | null {
    return this.currentSnapshot;
  }

  private generateId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Gera diff visual para um arquivo
  generateFileDiff(oldContent: string, newContent: string): {
    added: string[];
    removed: string[];
    modified: string[];
  } {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Algoritmo simples de diff
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        added.push(`+ ${newLine}`);
      } else if (newLine === undefined) {
        removed.push(`- ${oldLine}`);
      } else if (oldLine !== newLine) {
        modified.push(`~ ${oldLine} → ${newLine}`);
      }
    }

    return { added, removed, modified };
  }

  // Estatísticas de mudanças
  getChangeStats(snapshotId: string): {
    totalChanges: number;
    created: number;
    modified: number;
    deleted: number;
    filesAffected: number;
  } {
    const changes = this.getChanges(snapshotId);
    const filesAffected = new Set(changes.map(c => c.path)).size;

    return {
      totalChanges: changes.length,
      created: changes.filter(c => c.type === 'created').length,
      modified: changes.filter(c => c.type === 'modified').length,
      deleted: changes.filter(c => c.type === 'deleted').length,
      filesAffected
    };
  }
}

export const diffTracker = new DiffTracker();
