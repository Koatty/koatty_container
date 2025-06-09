/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { DefaultLogger as logger } from "koatty_logger";
import { LRUCache } from "lru-cache";

/**
 * Cache types for unified cache management
 */
export enum CacheType {
  REFLECT_METADATA = 'reflect',
  PROPERTY_METADATA = 'property',
  CLASS_METADATA = 'class',
  DEPENDENCY = 'dependency',
  DEPENDENCY_PREPROCESS = 'dependencyPreprocess',
  AOP_INTERCEPTORS = 'aopInterceptors',
  METHOD_NAMES = 'methodNames',
  ASPECT_INSTANCES = 'aspectInstances'
}

/**
 * Cache statistics for monitoring performance
 */
interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  memoryUsage: number;
}

/**
 * Detailed cache statistics by type
 */
interface DetailedCacheStats extends CacheStats {
  byType: Record<string, {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  }>;
}

/**
 * High-performance unified metadata cache system with intelligent caching strategies
 * 
 * Features:
 * - Unified LRU cache management for all cache types
 * - Cache statistics and monitoring by type
 * - Preloading mechanism for frequently accessed metadata
 * - Memory usage optimization
 * - Batch operations for better performance
 */
export class MetadataCache {
  private caches: Map<CacheType, LRUCache<string, any>>;
  private stats: Record<CacheType, { hits: number; misses: number }>;
  private defaultTTL: number;
  private maxMemoryUsage: number;
  
  // Preload registry for frequently accessed metadata
  private preloadRegistry: Set<string>;
  private hotKeys: Map<string, number>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: {
    capacity?: number;
    defaultTTL?: number; // milliseconds
    maxMemoryUsage?: number; // bytes
    cacheConfigs?: Partial<Record<CacheType, { capacity?: number; ttl?: number }>>;
  } = {}) {
    const {
      capacity = 1000,
      defaultTTL = 5 * 60 * 1000, // 5 minutes
      maxMemoryUsage = 50 * 1024 * 1024, // 50MB
      cacheConfigs = {}
    } = options;

    this.defaultTTL = defaultTTL;
    this.maxMemoryUsage = maxMemoryUsage;
    this.caches = new Map();
    this.stats = {} as Record<CacheType, { hits: number; misses: number }>;
    
    // Initialize caches for each type
    Object.values(CacheType).forEach(type => {
      const config = cacheConfigs[type] || {};
      const cacheCapacity = config.capacity || this.getDefaultCapacity(type, capacity);
      const cacheTTL = config.ttl || defaultTTL;
      
      const cacheOptions = {
        max: cacheCapacity,
        ttl: cacheTTL,
        allowStale: false,
        updateAgeOnGet: true,
        updateAgeOnHas: false,
      };

      this.caches.set(type, new LRUCache<string, any>(cacheOptions));
      this.stats[type] = { hits: 0, misses: 0 };
    });
    
    this.preloadRegistry = new Set();
    this.hotKeys = new Map();
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.Debug(`MetadataCache initialized with ${this.caches.size} cache types, base capacity: ${capacity}, TTL: ${defaultTTL}ms`);
  }

  /**
   * Get default capacity for specific cache type
   */
  private getDefaultCapacity(type: CacheType, baseCapacity: number): number {
    switch (type) {
      case CacheType.DEPENDENCY:
      case CacheType.DEPENDENCY_PREPROCESS:
        return Math.floor(baseCapacity / 2); // Smaller for dependency caches
      case CacheType.AOP_INTERCEPTORS:
      case CacheType.ASPECT_INSTANCES:
        return Math.floor(baseCapacity * 0.3); // Medium for AOP caches
      case CacheType.METHOD_NAMES:
        return Math.floor(baseCapacity * 0.4); // Medium for method names
      default:
        return baseCapacity; // Full capacity for metadata caches
    }
  }

  /**
   * Generic get operation for any cache type
   */
  get<T = any>(type: CacheType, key: string): T | undefined {
    const cache = this.caches.get(type);
    if (!cache) {
      logger.Error(`Cache type ${type} not found`);
      return undefined;
    }

    const value = cache.get(key);
    
    if (value !== undefined) {
      this.stats[type].hits++;
      this.trackHotKey(key);
      logger.Debug(`Cache hit for ${key}`);
    } else {
      this.stats[type].misses++;
      logger.Debug(`Cache miss for ${key}, processing...`);
    }

    return value;
  }

  /**
   * Generic set operation for any cache type
   */
  set<T = any>(type: CacheType, key: string, value: T, ttl?: number): void {
    const cache = this.caches.get(type);
    if (!cache) {
      logger.Error(`Cache type ${type} not found`);
      return;
    }

    if (ttl !== undefined) {
      cache.set(key, value, { ttl });
    } else {
      cache.set(key, value);
    }

    logger.Debug(`Cached ${key} in ${type} cache`);
  }

  /**
   * Check if key exists in cache
   */
  has(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type);
    return cache ? cache.has(key) : false;
  }

  /**
   * Delete key from cache
   */
  delete(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type);
    return cache ? cache.delete(key) : false;
  }

  /**
   * Get cache size for specific type
   */
  size(type: CacheType): number {
    const cache = this.caches.get(type);
    return cache ? cache.size : 0;
  }

  /**
   * Clear specific cache type
   */
  clearType(type: CacheType): void {
    const cache = this.caches.get(type);
    if (cache) {
      cache.clear();
      this.stats[type] = { hits: 0, misses: 0 };
      logger.Debug(`Cleared ${type} cache`);
    }
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.caches.forEach((cache, type) => {
      cache.clear();
      this.stats[type] = { hits: 0, misses: 0 };
    });
    this.preloadRegistry.clear();
    this.hotKeys.clear();
    
    // Stop cleanup timer to prevent memory leaks
    this.stopCleanupTimer();
    
    logger.Debug('All caches cleared');
  }

  /**
   * Batch get operation for better performance
   */
  batchGet<T = any>(type: CacheType, keys: string[]): Map<string, T> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = this.get<T>(type, key);
      if (value !== undefined) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  /**
   * Batch set operation for better performance
   */
  batchSet<T = any>(type: CacheType, entries: Map<string, T>, ttl?: number): void {
    for (const [key, value] of entries) {
      this.set(type, key, value, ttl);
    }
  }

  /**
   * Register keys for preloading
   */
  registerForPreload(keys: string[]): void {
    keys.forEach(key => this.preloadRegistry.add(key));
    logger.Debug(`Registered ${keys.length} keys for preloading`);
  }

  /**
   * Preload frequently accessed metadata
   */
  preload(type: CacheType, metadataProvider: (key: string) => any): void {
    const preloadStart = Date.now();
    let preloadedCount = 0;

    for (const key of this.preloadRegistry) {
      if (!this.has(type, key)) {
        try {
          const value = metadataProvider(key);
          if (value !== undefined) {
            this.set(type, key, value);
            preloadedCount++;
          }
        } catch (error) {
          logger.Error(`Failed to preload metadata for key ${key}:`, error);
        }
      }
    }

    const preloadTime = Date.now() - preloadStart;
    logger.Info(`Preloaded ${preloadedCount} ${type} entries in ${preloadTime}ms`);
  }

  /**
   * Get detailed cache statistics
   */
  getStats(): DetailedCacheStats {
    let totalHits = 0;
    let totalMisses = 0;
    let totalMemoryUsage = 0;
    const byType: Record<string, any> = {};

    this.caches.forEach((cache, type) => {
      const typeStats = this.stats[type];
      const hits = typeStats.hits;
      const misses = typeStats.misses;
      const hitRate = (hits + misses) > 0 ? hits / (hits + misses) : 0;

      byType[type] = {
        size: cache.size,
        hits,
        misses,
        hitRate
      };

      totalHits += hits;
      totalMisses += misses;
      totalMemoryUsage += this.estimateCacheMemoryUsage(cache);
    });

    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      hits: totalHits,
      misses: totalMisses,
      totalRequests,
      hitRate,
      memoryUsage: totalMemoryUsage,
      byType
    };
  }

  /**
   * Optimize cache performance
   */
  optimize(): void {
    const optimizeStart = Date.now();
    let totalCleaned = 0;

    this.caches.forEach((cache, type) => {
      const initialSize = cache.size;
      
      // Clean stale entries
      cache.purgeStale();
      
      const finalSize = cache.size;
      const cleaned = initialSize - finalSize;
      totalCleaned += cleaned;
      
      logger.Debug(`Optimized ${type} cache: removed ${cleaned} stale entries`);
    });

    const optimizeTime = Date.now() - optimizeStart;
    logger.Info(`Cache optimization completed: removed ${totalCleaned} stale entries in ${optimizeTime}ms`);
  }

  /**
   * Convenience methods for specific cache types
   */

  // Reflect metadata cache
  getReflectMetadata(key: string, target: any, propertyKey?: string | symbol): any {
    const cacheKey = this.buildReflectKey(key, target, propertyKey);
    return this.get(CacheType.REFLECT_METADATA, cacheKey);
  }

  setReflectMetadata(key: string, target: any, value: any, propertyKey?: string | symbol, ttl?: number): void {
    const cacheKey = this.buildReflectKey(key, target, propertyKey);
    this.set(CacheType.REFLECT_METADATA, cacheKey, value, ttl);
  }

  // Property metadata cache
  getPropertyMetadata(decoratorKey: string, target: any, propertyName: string | symbol): any {
    const cacheKey = this.buildPropertyKey(decoratorKey, target, propertyName);
    return this.get(CacheType.PROPERTY_METADATA, cacheKey);
  }

  setPropertyMetadata(decoratorKey: string, target: any, propertyName: string | symbol, value: any, ttl?: number): void {
    const cacheKey = this.buildPropertyKey(decoratorKey, target, propertyName);
    this.set(CacheType.PROPERTY_METADATA, cacheKey, value, ttl);
  }

  // Class metadata cache
  getClassMetadata(type: string, decoratorKey: string, target: any, propertyName?: string): any {
    const cacheKey = this.buildClassKey(type, decoratorKey, target, propertyName);
    return this.get(CacheType.CLASS_METADATA, cacheKey);
  }

  setClassMetadata(type: string, decoratorKey: string, target: any, value: any, propertyName?: string, ttl?: number): void {
    const cacheKey = this.buildClassKey(type, decoratorKey, target, propertyName);
    this.set(CacheType.CLASS_METADATA, cacheKey, value, ttl);
  }

  // Dependencies cache
  getCachedDependencies(target: any): string[] | undefined {
    const cacheKey = this.buildDependencyKey(target);
    return this.get(CacheType.DEPENDENCY, cacheKey);
  }

  setCachedDependencies(target: any, dependencies: string[], ttl?: number): void {
    const cacheKey = this.buildDependencyKey(target);
    this.set(CacheType.DEPENDENCY, cacheKey, dependencies, ttl);
  }

  // Dependency preprocess cache
  getDependencyPreprocess<T = any>(key: string): T | undefined {
    return this.get(CacheType.DEPENDENCY_PREPROCESS, key);
  }

  setDependencyPreprocess<T = any>(key: string, value: T, ttl?: number): void {
    this.set(CacheType.DEPENDENCY_PREPROCESS, key, value, ttl);
  }

  // AOP interceptors cache
  getAOPInterceptor<T = any>(key: string): T | undefined {
    return this.get(CacheType.AOP_INTERCEPTORS, key);
  }

  setAOPInterceptor<T = any>(key: string, value: T, ttl?: number): void {
    this.set(CacheType.AOP_INTERCEPTORS, key, value, ttl);
  }

  // Method names cache
  getMethodNames(key: string): string[] | undefined {
    return this.get(CacheType.METHOD_NAMES, key);
  }

  setMethodNames(key: string, methods: string[], ttl?: number): void {
    this.set(CacheType.METHOD_NAMES, key, methods, ttl);
  }

  // Aspect instances cache
  getAspectInstance<T = any>(key: string): T | undefined {
    return this.get(CacheType.ASPECT_INSTANCES, key);
  }

  setAspectInstance<T = any>(key: string, aspect: T, ttl?: number): void {
    this.set(CacheType.ASPECT_INSTANCES, key, aspect, ttl);
  }

  /**
   * Key building methods
   */
  private buildReflectKey(key: string, target: any, propertyKey?: string | symbol): string {
    const className = target.name || target.constructor?.name || 'Anonymous';
    const prop = propertyKey ? `:${String(propertyKey)}` : '';
    return `reflect:${key}:${className}${prop}`;
  }

  private buildPropertyKey(decoratorKey: string, target: any, propertyName: string | symbol): string {
    const className = target.name || target.constructor?.name || 'Anonymous';
    return `property:${decoratorKey}:${className}:${String(propertyName)}`;
  }

  private buildClassKey(type: string, decoratorKey: string, target: any, propertyName?: string): string {
    const className = target.name || target.constructor?.name || 'Anonymous';
    const prop = propertyName ? `:${propertyName}` : '';
    return `class:${type}:${decoratorKey}:${className}${prop}`;
  }

  private buildDependencyKey(target: any): string {
    const className = target.name || target.constructor?.name || 'Anonymous';
    return `dependency:${className}`;
  }

  /**
   * Track hot keys for optimization
   */
  private trackHotKey(key: string): void {
    const count = this.hotKeys.get(key) || 0;
    this.hotKeys.set(key, count + 1);
  }

  /**
   * Estimate memory usage of a cache
   */
  private estimateCacheMemoryUsage(cache: LRUCache<string, any>): number {
    // Rough estimation: 100 bytes per entry on average
    return cache.size * 100;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.defaultTTL); // Cleanup every TTL period
    
    // Use unref to allow the process to exit
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Cleanup stale data and optimize memory usage
   */
  private cleanup(): void {
    // Check memory usage
    const stats = this.getStats();
    if (stats.memoryUsage > this.maxMemoryUsage) {
      logger.Warn(`Cache memory usage (${stats.memoryUsage} bytes) exceeds limit (${this.maxMemoryUsage} bytes), performing cleanup`);
      this.optimize();
    }

    // Clean up hot keys map if it gets too large
    if (this.hotKeys.size > 10000) {
      this.hotKeys.clear();
      logger.Debug('Cleared hot keys map due to size limit');
    }
  }
} 