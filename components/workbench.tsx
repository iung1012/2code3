import { useState } from 'react';
import { useWorkbenchStore } from '@/lib/stores/workbench-store';
import { useFileStore } from '@/lib/stores/file-store';
import { useEditorStore } from '@/lib/stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Code, 
  Eye, 
  Folder, 
  Save, 
  RefreshCw, 
  Lock, 
  Unlock, 
  FileText,
  FolderOpen,
  Download,
  Trash2
} from 'lucide-react';
import { logger } from '@/lib/logger';

export function Workbench() {
  const workbenchStore = useWorkbenchStore();
  const fileStore = useFileStore();
  const editorStore = useEditorStore();
  
  const [selectedFile, setSelectedFile] = useState<string>('');

  if (!workbenchStore.showWorkbench) {
    return null;
  }

  const files = fileStore.files;
  const fileList = Object.entries(files).filter(([, dirent]) => dirent?.type === 'file');
  const folderList = Object.entries(files).filter(([, dirent]) => dirent?.type === 'folder');

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    editorStore.setSelectedFile(filePath);
  };

  const handleSaveFile = async (filePath: string) => {
    try {
      await workbenchStore.saveFile(filePath);
      logger.debug('File saved', { filePath });
    } catch (error) {
      logger.error('Failed to save file', error);
    }
  };

  const handleSaveAll = async () => {
    try {
      await workbenchStore.saveAllFiles();
      logger.debug('All files saved');
    } catch (error) {
      logger.error('Failed to save all files', error);
    }
  };

  const handleLockFile = (filePath: string) => {
    const isLocked = fileStore.isFileLocked(filePath).locked;
    if (isLocked) {
      fileStore.unlockFile(filePath);
    } else {
      fileStore.lockFile(filePath);
    }
  };

  const handleDeleteFile = (filePath: string) => {
    if (confirm(`Tem certeza que deseja deletar ${filePath}?`)) {
      fileStore.deleteFile(filePath);
      if (selectedFile === filePath) {
        setSelectedFile('');
      }
    }
  };

  const currentDocument = editorStore.currentDocument;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">Workbench</CardTitle>
          <div className="flex items-center gap-2">
            {workbenchStore.hasUnsavedChanges && (
              <Badge variant="destructive" className="text-xs">
                {workbenchStore.unsavedFiles.size} arquivo(s) não salvo(s)
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAll}
              disabled={!workbenchStore.hasUnsavedChanges}
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Tudo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => workbenchStore.setShowWorkbench(false)}
            >
              Fechar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex gap-4 overflow-hidden">
          {/* Sidebar - File Tree */}
          <div className="w-80 border-r border-border/40 pr-4">
            <Tabs value={workbenchStore.currentView} onValueChange={(value) => 
              workbenchStore.setCurrentView(value as any)
            }>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="files" className="flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  Arquivos
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="mt-4">
                <ScrollArea className="h-[calc(90vh-200px)]">
                  <div className="space-y-2">
                    {/* Folders */}
                    {folderList.map(([folderPath, folder]) => (
                      <div key={folderPath} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{folderPath}</span>
                        {folder?.isLocked && (
                          <Lock className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                    ))}

                    {/* Files */}
                    {fileList.map(([filePath, file]) => {
                      const isLocked = fileStore.isFileLocked(filePath).locked;
                      const isSelected = selectedFile === filePath;
                      
                      return (
                        <div
                          key={filePath}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-primary/10 border border-primary/20' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleFileSelect(filePath)}
                        >
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium flex-1 truncate">
                            {filePath.split('/').pop()}
                          </span>
                          <div className="flex items-center gap-1">
                            {isLocked && (
                              <Lock className="w-3 h-3 text-yellow-500" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLockFile(filePath);
                              }}
                            >
                              {isLocked ? (
                                <Unlock className="w-3 h-3" />
                              ) : (
                                <Lock className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(filePath);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="h-[calc(90vh-200px)] bg-muted/20 rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Preview será implementado aqui</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Main Content - Editor */}
          <div className="flex-1 flex flex-col">
            {currentDocument ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    <span className="font-medium">{currentDocument.filePath}</span>
                    {workbenchStore.unsavedFiles.has(currentDocument.filePath) && (
                      <Badge variant="outline" className="text-xs">
                        Não salvo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => workbenchStore.saveCurrentDocument()}
                      disabled={!workbenchStore.unsavedFiles.has(currentDocument.filePath)}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => workbenchStore.resetCurrentDocument()}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resetar
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 border border-border/40 rounded-lg">
                  <div className="p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {currentDocument.value}
                    </pre>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um arquivo para editar</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
