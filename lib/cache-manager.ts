interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
}

export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private generateKey(input: string): string {
    // Gera hash simples para usar como chave
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private calculateHash(data: T): string {
    return JSON.stringify(data).slice(0, 16) || 'default';
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: T): void {
    // Remove entrada mais antiga se cache está cheio
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hash: this.calculateHash(data)
    });
  }

  getOrSet(key: string, factory: () => T): T {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const data = factory();
    this.set(key, data);
    return data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Método para cache baseado em hash de arquivos
  getByHash(files: Record<string, string>): T | null {
    const hash = this.calculateFileHash(files);
    return this.get(hash);
  }

  setByHash(files: Record<string, string>, data: T): void {
    const hash = this.calculateFileHash(files);
    this.set(hash, data);
  }

  private calculateFileHash(files: Record<string, string>): string {
    const sortedFiles = Object.keys(files)
      .sort()
m      .map(key => `${key}:${files[key] || ''}`)
      .join('|');
    
    return this.calculateHash(sortedFiles as any);
  }
}

// Instâncias específicas para diferentes tipos de cache
export const fileCache = new CacheManager<Record<string, string>>(50, 10 * 60 * 1000); // 10 min
export const parsingCache = new CacheManager<string>(100, 5 * 60 * 1000); // 5 min
export const webContainerCache = new CacheManager<any>(20, 2 * 60 * 1000); // 2 min
