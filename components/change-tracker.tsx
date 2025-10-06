"use client"

import { useState, useEffect } from "react"
import { diffTracker, FileChange } from "@/lib/diff-tracker"
import { commandQueue } from "@/lib/command-queue"
import { debouncedUpdater } from "@/lib/debounced-updater"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText, 
  Terminal, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Trash2
} from "lucide-react"

export function ChangeTracker() {
  const [snapshots, setSnapshots] = useState(diffTracker.getSnapshotHistory())
  const [commands, setCommands] = useState(commandQueue.getCompletedCommands())
  const [queueStatus, setQueueStatus] = useState(commandQueue.getQueueStatus())
  const [pendingStats, setPendingStats] = useState(debouncedUpdater.getPendingStats())

  useEffect(() => {
    const interval = setInterval(() => {
      setSnapshots(diffTracker.getSnapshotHistory())
      setCommands(commandQueue.getCompletedCommands())
      setQueueStatus(commandQueue.getQueueStatus())
      setPendingStats(debouncedUpdater.getPendingStats())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const getChangeIcon = (type: FileChange['type']) => {
    switch (type) {
      case 'created': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'modified': return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'deleted': return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getChangeColor = (type: FileChange['type']) => {
    switch (type) {
      case 'created': return 'bg-green-100 text-green-800'
      case 'modified': return 'bg-yellow-100 text-yellow-800'
      case 'deleted': return 'bg-red-100 text-red-800'
    }
  }

  const getCommandStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
      case 'running': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="changes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="changes" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Changes ({snapshots.length})
          </TabsTrigger>
          <TabsTrigger value="commands" className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Commands ({commands.length})
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="space-y-4">
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No changes tracked yet
            </div>
          ) : (
            snapshots.map((snapshot) => (
              <Card key={snapshot.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Snapshot {snapshot.id.slice(-8)}</span>
                    <Badge variant="outline">
                      {new Date(snapshot.timestamp).toLocaleTimeString()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {snapshot.changes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No changes</div>
                  ) : (
                    snapshot.changes.map((change, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {getChangeIcon(change.type)}
                        <Badge className={getChangeColor(change.type)}>
                          {change.type}
                        </Badge>
                        <span className="font-mono text-xs">{change.path}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          {commands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No commands executed yet
            </div>
          ) : (
            commands.map((command) => (
              <Card key={command.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="font-mono">{command.command}</span>
                    <div className="flex items-center gap-2">
                      {getCommandStatusIcon(command.status)}
                      {command.duration && (
                        <Badge variant="outline">
                          {command.duration.toFixed(0)}ms
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {command.output && (
                    <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                      {command.output}
                    </div>
                  )}
                  {command.error && (
                    <div className="text-xs font-mono bg-red-100 text-red-800 p-2 rounded">
                      {command.error}
                    </div>
                  )}
                  {command.status === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => commandQueue.retryCommand(command.id)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Queue Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Pending:</span>
                  <Badge variant="outline">{queueStatus.pending}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Running:</span>
                  <Badge variant="outline">{queueStatus.running}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Completed:</span>
                  <Badge variant="outline">{queueStatus.completed}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Failed:</span>
                  <Badge variant="outline">{queueStatus.failed}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pending Updates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Files:</span>
                  <Badge variant="outline">{pendingStats.fileCount}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Commands:</span>
                  <Badge variant="outline">{pendingStats.commandCount}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Size:</span>
                  <Badge variant="outline">
                    {(pendingStats.totalSize / 1024).toFixed(1)}KB
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => commandQueue.clearCompleted()}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear Completed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => debouncedUpdater.flush()}
              disabled={!debouncedUpdater.hasPendingUpdates()}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Flush Updates
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
