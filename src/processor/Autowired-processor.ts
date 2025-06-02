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
import { IContainer, ObjectDefinitionOptions, TAGGED_PROP } from "../container/IContainer";
import { recursiveGetMetadata } from "../utils/MetadataOpertor";
import { MetadataCache, CacheType } from "../utils/MetadataCache";

/**
 * Interface for dependency preprocessing data
 */
interface DependencyPreProcessData {
  dependencies: {
    name: string;
    type?: string;
    method?: Function;
    args?: any[];
  }[];
  processedAt: number;
  target: Function;
}

// Unified cache instance for all Autowired operations
const metadataCache = new MetadataCache({
  capacity: 1500,
  defaultTTL: 8 * 60 * 1000, // 8 minutes for dependency cache
  cacheConfigs: {
    [CacheType.DEPENDENCY_PREPROCESS]: { capacity: 800, ttl: 12 * 60 * 1000 }
  }
});

/**
 * Get cached dependency preprocessing data
 */
function getCachedDependencyPreprocess(cacheKey: string): DependencyPreProcessData | undefined {
  return metadataCache.getDependencyPreprocess<DependencyPreProcessData>(cacheKey);
}

/**
 * Cache dependency preprocessing data
 */
function cacheDependencyPreprocess(cacheKey: string, data: DependencyPreProcessData): void {
  metadataCache.setDependencyPreprocess(cacheKey, data);
}

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
  logger.Debug(`Dependency cache stats - Size: ${stats.cacheSize}, Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
}

/**
 * Preprocess dependencies for a class with advanced caching
 */
function preprocessDependencies(target: Function, container: IContainer): DependencyPreProcessData {
  const className = target.name || 'Anonymous';
  const cacheKey = `dep_preprocess:${className}:${target.toString().length}`;
  
  // Try to get from cache first
  const cached = getCachedDependencyPreprocess(cacheKey);
  if (cached) {
    logger.Debug(`Using cached dependency preprocessing for ${className}`);
    return cached;
  }

  logger.Debug(`Preprocessing dependencies for ${className}`);
  
  const metaData = recursiveGetMetadata(container, TAGGED_PROP, target);
  const dependencies: DependencyPreProcessData['dependencies'] = [];
  
  // Process each dependency
  for (const { name, type, method, args } of Object.values(metaData)) {
    if (name) {
      dependencies.push({
        name,
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
  cacheDependencyPreprocess(cacheKey, processedData);
  
  logger.Debug(`Preprocessed ${dependencies.length} dependencies for ${className}`);
  return processedData;
}

/**
 * Enhanced dependency injection with preprocessing and caching
 */
export function injectAutowired(target: Function, prototypeChain: object,
  container: IContainer, _options?: ObjectDefinitionOptions) {
  
  const injectionStart = Date.now();
  const className = target.name || 'Anonymous';
  
  try {
    // Get or preprocess dependencies
    let preprocessedData = getCachedDependencyPreprocess(`dep_preprocess:${className}:${target.toString().length}`);
    if (!preprocessedData) {
      preprocessedData = preprocessDependencies(target, container);
    }

    if (!preprocessedData.dependencies || preprocessedData.dependencies.length === 0) {
      logger.Debug(`No dependencies to inject for ${className}`);
      return;
    }

    let injectedCount = 0;

    // Inject each dependency
    for (const dependency of preprocessedData.dependencies) {
      try {
        let targetValue = dependency.method ? dependency.method() : container.get(dependency.name, dependency.type, ...(dependency.args || []));
        
        // Handle dependency resolution errors gracefully
        if (!targetValue) {
          logger.Warn(`Failed to resolve dependency ${dependency.name} for ${className}, using fallback`);
          targetValue = {}; // Fallback empty object
        }

        Reflect.defineProperty(prototypeChain, dependency.name, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: targetValue,
        });

        injectedCount++;
        logger.Debug(`Injected dependency ${dependency.name} into ${className}`);
      } catch (error) {
        logger.Error(`Failed to inject dependency ${dependency.name} into ${className}:`, error);
        
        // Create a fallback empty object for failed dependencies
        Reflect.defineProperty(prototypeChain, dependency.name, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: {},
        });
      }
    }

    const injectionTime = Date.now() - injectionStart;
    logger.Debug(`Dependency injection completed for ${className}: ${injectedCount}/${preprocessedData.dependencies.length} dependencies in ${injectionTime}ms`);

  } catch (error) {
    logger.Error(`Failed to inject dependencies for ${className}:`, error);
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
  logger.Debug(`Batch preprocessed dependencies for ${processedCount}/${targets.length} targets in ${batchTime}ms`);
}

/**
 * Clear dependency preprocessing cache
 */
export function clearDependencyCache(): void {
  metadataCache.clearType(CacheType.DEPENDENCY_PREPROCESS);
  logger.Debug('Dependency preprocessing cache cleared');
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
    logger.Debug(`Dependency cache optimized: removed ${cleaned} stale entries`);
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
  
  logger.Debug(`Dependency cache warmed up for ${targets.length} targets in ${warmupTime}ms`);
  logger.Debug(`Dependency cache stats - Size: ${stats.cacheSize}, Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
}

/**
 * Get dependency cache size information
 */
export function getDependencyCacheSize(): number {
  return metadataCache.size(CacheType.DEPENDENCY_PREPROCESS);
}
