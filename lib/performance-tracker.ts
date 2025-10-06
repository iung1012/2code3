interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000;

  trackTiming(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    });

    // Mantém apenas as últimas métricas
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log para desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PERF] ${operation}: ${duration.toFixed(2)}ms`, metadata);
    }
  }

  getAverageTime(operation: string): number {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    if (operationMetrics.length === 0) return 0;
    
    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  getMetrics(operation?: string): PerformanceMetric[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation);
    }
    return [...this.metrics];
  }

  getSlowestOperations(limit: number = 10): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  clear(): void {
    this.metrics = [];
  }

  // Método para medir operações assíncronas
  async measureAsync<T>(
    operation: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.trackTiming(operation, duration, { ...metadata, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.trackTiming(operation, duration, { ...metadata, success: false, error: error.message });
      throw error;
    }
  }

  // Método para medir operações síncronas
  measure<T>(
    operation: string, 
    fn: () => T, 
    metadata?: Record<string, any>
  ): T {
    const start = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.trackTiming(operation, duration, { ...metadata, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.trackTiming(operation, duration, { ...metadata, success: false, error: error.message });
      throw error;
    }
  }

  // Gera relatório de performance
  generateReport(): {
    totalOperations: number;
    averageTime: number;
    slowestOperations: PerformanceMetric[];
    operationStats: Record<string, { count: number; avgTime: number; totalTime: number }>;
  } {
    const operationStats: Record<string, { count: number; avgTime: number; totalTime: number }> = {};
    
    this.metrics.forEach(metric => {
      if (!operationStats[metric.operation]) {
        operationStats[metric.operation] = { count: 0, avgTime: 0, totalTime: 0 };
      }
      
      operationStats[metric.operation].count++;
      operationStats[metric.operation].totalTime += metric.duration;
    });

    // Calcula médias
    Object.keys(operationStats).forEach(op => {
      const stats = operationStats[op];
      stats.avgTime = stats.totalTime / stats.count;
    });

    const totalTime = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageTime = this.metrics.length > 0 ? totalTime / this.metrics.length : 0;

    return {
      totalOperations: this.metrics.length,
      averageTime,
      slowestOperations: this.getSlowestOperations(5),
      operationStats
    };
  }
}

// Instância global
export const performanceTracker = new PerformanceTracker();

// Hook para React
export function usePerformanceTracking() {
  return {
    trackTiming: performanceTracker.trackTiming.bind(performanceTracker),
    measureAsync: performanceTracker.measureAsync.bind(performanceTracker),
    measure: performanceTracker.measure.bind(performanceTracker),
    getMetrics: performanceTracker.getMetrics.bind(performanceTracker),
    getReport: performanceTracker.generateReport.bind(performanceTracker)
  };
}
