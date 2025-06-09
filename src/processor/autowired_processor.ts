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
import { recursiveGetMetadata } from "../utils/opertor";
import { MetadataCache, CacheType } from "../utils/cache";

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
      return;
    }

    let injectedCount = 0;
    const delayedDependencies: Array<{
      dependency: { name: string; propertyKey: string; type?: string; method?: Function; args?: any[] };
      isCircular: boolean;
    }> = [];
    
    // Step 0: Complete circular dependency detection for ALL dependencies (principle 6+)
    // Class successful registration doesn't mean no circular dependencies exist
    const detector = container.getCircularDependencyDetector();
    const hasCircularDeps = detector.hasCircularDependencies();
    const allCircularDeps = hasCircularDeps ? detector.getAllCircularDependencies() : [];
    
    // Check each dependency for circular relationships, regardless of immediate availability
    const dependencyCircularityMap = new Map<string, boolean>();
    for (const dependency of preprocessedData.dependencies) {
      if (dependency.name) {
        const isCircularDependency = allCircularDeps.some(cycle => 
          cycle.includes(className) || cycle.includes(dependency.name)
        );
        dependencyCircularityMap.set(dependency.propertyKey, isCircularDependency);
        
        if (isCircularDependency) {
          logger.Debug(`Circular dependency detected: ${className}.${dependency.propertyKey} -> ${dependency.name} (even if resolvable)`);
        }
      }
    }
    
    // Step 1: Process each dependency individually with improved string identifier support
    for (const dependency of preprocessedData.dependencies) {
      let dependencyValue: any = undefined;
      let resolved = false;
      let isCircular = false;
      
      // First, check for circular dependencies (principle 6+)
      // Class successful registration doesn't mean no circular dependencies exist
      isCircular = dependencyCircularityMap.get(dependency.name) || false;
      
      try {
        if (dependency.type === 'string') {
          // Enhanced string identifier resolution (principle 3)
          // Priority: immediate injection if class registered and no actual circular dependency
          const targetClass = container.getClass(dependency.name);
          
          if (targetClass && !isCircular) {
            // Class is registered and no circular dependency detected - immediate injection
            dependencyValue = container.get(dependency.name);
            if (dependencyValue !== undefined) {
              resolved = true;
            }
          } else if (targetClass && isCircular) {
            // Class is registered but circular dependency exists - use delayed loading
            logger.Debug(`Circular dependency detected: ${className}.${dependency.propertyKey} -> ${dependency.name} (even if resolvable)`);
            resolved = false; // Force delayed loading
          } else {
            // Class not registered - will need delayed loading
            resolved = false;
          }
        } else {
          // CLASS type dependency resolution
          if (!isCircular) {
            dependencyValue = container.get(dependency.name);
            if (dependencyValue !== undefined) {
              resolved = true;
            }
          } else {
            logger.Debug(`Using delayed loading for circular dependency: ${className}.${dependency.propertyKey} -> ${dependency.name}`);
            resolved = false;
          }
        }
        
        if (resolved && dependencyValue !== undefined) {
          // Immediate injection to prototype (principle 2)
          Object.defineProperty(prototypeChain, dependency.propertyKey, {
            value: dependencyValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
          injectedCount++;
          logger.Debug(`Immediately injected: ${className}.${dependency.propertyKey} = ${dependency.name}`);
        } else {
          // Add to delayed dependencies for later processing
          delayedDependencies.push({
            dependency,
            isCircular
          });
          logger.Debug(`Delayed dependency: ${className}.${dependency.propertyKey} -> ${dependency.name}${isCircular ? ' (circular)' : ' (not available)'}`);
        }
      } catch (error) {
        // If immediate injection fails, add to delayed dependencies
        delayedDependencies.push({
          dependency,
          isCircular
        });
        logger.Debug(`Failed immediate injection for ${className}.${dependency.propertyKey}, will use delayed loading: ${error}`);
      }
    }
    
    // Step 2: Set up delayed loading for dependencies that couldn't be resolved immediately
    if (delayedDependencies.length > 0) {
      setupDelayedInjection(container, prototypeChain, className, delayedDependencies);
    }

    const injectionTime = Date.now() - injectionStart;
    logger.Debug(`Dependency injection completed for ${className}: ${injectedCount}/${preprocessedData.dependencies.length} dependencies in ${injectionTime}ms`);

  } catch (error) {
    logger.Error(`Autowired injection failed for ${className}:`, error);
    throw error;
  }
}

/**
 * Set up delayed injection for dependencies that couldn't be resolved immediately
 * This includes circular dependencies and dependencies that are not yet available
 */
function setupDelayedInjection(
  container: IContainer, 
  prototypeChain: object, 
  className: string,
  delayedDependencies: Array<{
    dependency: { name: string; propertyKey: string; type?: string; method?: Function; args?: any[] };
    isCircular: boolean;
  }>
): void {
  const app = container.getApp();
  if (!app || typeof app.on !== 'function') {
    logger.Debug(`Cannot setup delayed injection for ${className}: app.on is not available`);
    return;
  }
  
  // Use a unique event handler to avoid duplicates
  const delayedInjectionHandler = () => {
    logger.Debug(`Executing delayed injection for ${className} with ${delayedDependencies.length} dependencies`);
    
    let successfulDelayedInjections = 0;
    let failedInjections = 0;
    
    for (const { dependency, isCircular } of delayedDependencies) {
      try {
        let delayedValue;
        let injectionSuccessful = false;
        
        if (isCircular) {
          // For circular dependencies, use a safer approach to avoid re-triggering circular detection
          try {
            const dependencyClass = container.getClass(dependency.name, dependency.type);
            if (dependencyClass) {
              delayedValue = container.getInsByClass(dependencyClass);
              injectionSuccessful = true;
            }
          } catch {
            // Fallback to property key for circular dependencies
            try {
              const dependencyClass = container.getClass(dependency.propertyKey, dependency.type);
              if (dependencyClass) {
                delayedValue = container.getInsByClass(dependencyClass);
                injectionSuccessful = true;
              }
            } catch {
              logger.Debug(`Circular dependency ${dependency.name} still not available for delayed injection`);
            }
          }
        } else {
          // For non-circular delayed dependencies, try normal resolution
          try {
            delayedValue = container.get(dependency.name, dependency.type);
            injectionSuccessful = true;
          } catch {
            // Fallback to propertyKey for string-based dependencies
            try {
              delayedValue = container.get(dependency.propertyKey, dependency.type);
              injectionSuccessful = true;
            } catch {
              logger.Debug(`Delayed dependency ${dependency.name} still not available`);
            }
          }
        }
        
        // Inject the resolved value or set to null if failed
        const finalValue = injectionSuccessful && delayedValue !== undefined ? delayedValue : null;
        
        // Always define the property on prototype to ensure all instances have access
        Object.defineProperty(prototypeChain, dependency.propertyKey, {
          value: finalValue,
          writable: true,
          enumerable: true,
          configurable: true
        });
        
        // Additionally, fix existing instances if they have undefined properties
        try {
          const targetClass = container.getClass(className);
          if (targetClass) {
            const instance = container.getInsByClass(targetClass);
            if (instance && (instance as any)[dependency.propertyKey] === undefined) {
              // Directly assign the value to existing instance
              (instance as any)[dependency.propertyKey] = finalValue;
            }
          }
        } catch {
          // Silently handle any errors in instance property setting
        }
        
        if (injectionSuccessful) {
          successfulDelayedInjections++;
          logger.Debug(`Successfully injected delayed dependency: ${className}.${dependency.propertyKey} = ${dependency.name}`);
        } else {
          failedInjections++;
          logger.Debug(`Failed to resolve delayed dependency ${className}.${dependency.propertyKey}, set to null`);
        }
        
      } catch (error) {
        failedInjections++;
        logger.Debug(`Failed to inject delayed dependency ${dependency.name} into ${className}.${dependency.propertyKey}:`, error);
        
        // Even on error, set property to null to ensure it exists
        try {
          Object.defineProperty(prototypeChain, dependency.propertyKey, {
            value: null,
            writable: true,
            enumerable: true,
            configurable: true
          });
        } catch {
          // Silently handle defineProperty errors
        }
      }
    }
    
    logger.Debug(`Delayed injection completed for ${className}: ${successfulDelayedInjections} successful, ${failedInjections} failed (set to null)`);
  };
  
  // Add event listener for delayed injection
  app.on('appReady', delayedInjectionHandler);
  logger.Debug(`Setup delayed injection for ${className} with ${delayedDependencies.length} dependencies`);
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
