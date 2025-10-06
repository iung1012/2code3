interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: string
  component?: string
  action?: string
  metadata?: Record<string, any>
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private enabled = false

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  private addLog(level: LogEntry['level'], message: string, metadata?: Record<string, any>) {
    if (!this.enabled) return

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    this.logs.push(logEntry)

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${logEntry.timestamp}] [${level.toUpperCase()}]`
      const component = logEntry.component ? ` [${logEntry.component}]` : ''
      const action = logEntry.action ? ` [${logEntry.action}]` : ''
      
      console.log(`${prefix}${component}${action} ${message}`, metadata || '')
    }
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.addLog('debug', message, metadata)
  }

  info(message: string, metadata?: Record<string, any>) {
    this.addLog('info', message, metadata)
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.addLog('warn', message, metadata)
  }

  error(message: string, error?: Error, metadata?: Record<string, any>) {
    this.addLog('error', message, {
      ...metadata,
      error: error?.message,
      stack: error?.stack,
    })
  }

  getLogs() {
    return [...this.logs]
  }

  clearLogs() {
    this.logs = []
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2)
  }
}

export const logger = new Logger()

// Enable logging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  logger.enable()
}
