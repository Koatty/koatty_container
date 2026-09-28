/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-02-26 17:07:01
 * @LastEditTime: 2025-02-26 17:37:07
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import { IContainer, ObjectDefinitionOptions, TAGGED_PROP } from "../container/icontainer";
import { recursiveGetMetadata } from "../utils/operator";
import { MetadataCache, CacheType } from "../utils/cache";
import { debugLog } from "../utils/debug";
import { createLazyProxy } from "../utils/lazy_proxy";

/**
 * Interface for dependency preprocessing data
 */
interface DependencyPreProcessData {
  dependencies: {
    name: string;
    propertyKey: string;
    type?: string;
    method?: Function;
    args?: any[];
  }[];
  processedAt: number;
  target: Function;
}

// WeakMap for dependency preprocessing data (avoids Function.toString() overhead and key collisions)
// eslint-disable-next-line prefer-const
let dependencyWeakCache = new WeakMap<Function, DependencyPreProcessData>();

// Unified shared cache instance for all Autowired operations
const metadataCache = MetadataCache.getShared();

/**
 * Get cache statistics for dependency preprocessing
 */
export function getAutowiredCacheStats() {
  const stats = metadataCache.getStats();
  const dependencyStats = stats.byType[CacheType.DEPENDENCY_PREPROCESS] || { hits: 0, misses: 0, hitRate: 0, size: 0 };
  
  return {
    cacheSize: dependencyStats.size,
    hitRate: dependencyStats.hitRate,
    memoryUsage: stats.memoryUsage
  };
}

/**
 * Log dependency cache performance
 */
export function logDependencyCachePerformance() {
  const stats = getAutowiredCacheStats();
  debugLog(() => `Dependency cache stats - Size: ${stats.cacheSize}, Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
}

/**
 * Preprocess dependencies for a class with advanced caching
 */
function preprocessDependencies(target: Function, container: IContainer): DependencyPreProcessData {
  const className = target.name || 'Anonymous';
  
  // Try to get from cache first
  const cached = dependencyWeakCache.get(target);
  if (cached) {
    debugLog(() => `Using cached dependency preprocessing for ${className}`);
    return cached;
  }

  debugLog(() => `Preprocessing dependencies for ${className}`);
  
  const metaData = recursiveGetMetadata(container, TAGGED_PROP, target);
  const dependencies: DependencyPreProcessData['dependencies'] = [];
  
  // Process each dependency
  for (const key in metaData) {
    const { name, type, method, args, identifier } = metaData[key];
    // Use identifier for resolving the dependency, but keep the original key as the property name
    let dependencyName = identifier || name || key;
    
    // If identifier is a class constructor function, use its name
    if (typeof dependencyName === 'function' && dependencyName.name) {
      dependencyName = dependencyName.name;
    }
    
    if (dependencyName) {
      dependencies.push({
        name: dependencyName,        // Used for IOC container resolution
        propertyKey: key,           // Original property name to set on the instance
        type: type || undefined,
        method: helper.isFunction(method) ? method : undefined,
        args: args || undefined
      });
    }
  }

  const processedData: DependencyPreProcessData = {
    dependencies,
    processedAt: Date.now(),
    target
  };

  // Cache the processed data
  dependencyWeakCache.set(target, processedData);
  
  debugLog(() => `Preprocessed ${dependencies.length} dependencies for ${className}`);
  return processedData;
}

/**
 * Enhanced dependency injection with preprocessing and caching
 */
export function injectAutowired(target: Function, instance: object,
  container: IContainer, _options?: ObjectDefinitionOptions) {
  const metadata = recursiveGetMetadata(container, TAGGED_PROP, target);
  for (const [key, data] of Object.entries(metadata)) {
    const dep: any = data;
    const name = typeof dep.identifier === 'function' ? dep.identifier.name : dep.identifier ?? dep.name ?? key;
    const resolve = () => {
      const type = container.getClass(name, dep.type) ? dep.type : undefined;
      return container.get(name, type, ...(dep.args ?? []));
    };
    const hasClass = container.getClass(name, dep.type) || container.getClass(name, undefined)
      || container.getClass(name, 'SERVICE') || container.getClass(name, 'COMPONENT');
    const value = hasClass ? resolve() : createLazyProxy(resolve as () => object, `${target.name}.${key}`);
    Object.defineProperty(instance, key, { value, writable: true, enumerable: true, configurable: true });
  }
}

/**
 * Batch preprocess dependencies for multiple targets
 */
export function batchPreprocessDependencies(targets: Function[], container: IContainer): void {
  const batchStart = Date.now();
  let processedCount = 0;
  
  for (const target of targets) {
    try {
      preprocessDependencies(target, container);
      processedCount++;
    } catch (error) {
      logger.Error(`Failed to preprocess dependencies for ${target.name}:`, error);
    }
  }
  
  const batchTime = Date.now() - batchStart;
  debugLog(() => `Batch preprocessed dependencies for ${processedCount}/${targets.length} targets in ${batchTime}ms`);
}

/**
 * Clear dependency preprocessing cache
 */
export function clearDependencyCache(): void {
  dependencyWeakCache = new WeakMap();
  debugLog(() => 'Dependency preprocessing cache cleared');
}

/**
 * Optimize dependency cache performance
 */
export function optimizeDependencyCache(): void {
  const initialSize = metadataCache.size(CacheType.DEPENDENCY_PREPROCESS);
  
  metadataCache.optimize();
  
  const finalSize = metadataCache.size(CacheType.DEPENDENCY_PREPROCESS);
  const cleaned = initialSize - finalSize;
  
  if (cleaned > 0) {
    debugLog(() => `Dependency cache optimized: removed ${cleaned} stale entries`);
  }
}

/**
 * Warm up dependency cache for given targets
 */
export function warmupDependencyCache(targets: Function[], container: IContainer): void {
  const warmupStart = Date.now();
  
  batchPreprocessDependencies(targets, container);
  
  const warmupTime = Date.now() - warmupStart;
  const stats = getAutowiredCacheStats();
  
  debugLog(() => `Dependency cache warmed up for ${targets.length} targets in ${warmupTime}ms`);
  debugLog(() => `Dependency cache stats - Size: ${stats.cacheSize}, Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
}

/**
 * Get dependency cache size information
 * Returns the size from the metadata cache
 */
export function getDependencyCacheSize(): number {
  return metadataCache.size(CacheType.DEPENDENCY_PREPROCESS);
}
