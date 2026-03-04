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
import { IContainer, IContainerDiagnostics, ObjectDefinitionOptions, TAGGED_PROP } from "../container/icontainer";
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
export function injectAutowired(target: Function, prototypeChain: object,
  container: IContainer, _options?: ObjectDefinitionOptions) {
  
    const injectionStart = Date.now();
    const className = target.name || 'Anonymous';
    
    try {
    // Get or preprocess dependencies
    let preprocessedData = dependencyWeakCache.get(target);
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
    const diagnosticsContainer = container as unknown as IContainerDiagnostics;
    const detector = diagnosticsContainer.getCircularDependencyDetector();
    const hasCircularDeps = detector.hasCircularDependencies();
    const allCircularDeps = hasCircularDeps ? detector.getAllCircularDependencies() : [];
    
    debugLog(() => `[injectAutowired] className=${className}, hasCircularDeps=${hasCircularDeps}, allCircularDeps=${JSON.stringify(allCircularDeps)}`);
    
    // Check each dependency for circular relationships, regardless of immediate availability
    const dependencyCircularityMap = new Map<string, boolean>();
    for (const dependency of preprocessedData.dependencies) {
      if (dependency.name) {
        const isCircularDependency = allCircularDeps.some((cycle: string[]) =>
          cycle.includes(className) && cycle.includes(dependency.name)
        );
        dependencyCircularityMap.set(dependency.propertyKey, isCircularDependency);
        
        if (isCircularDependency) {
          debugLog(() => `Circular dependency detected: ${className}.${dependency.propertyKey} -> ${dependency.name} (even if resolvable)`);
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
      isCircular = dependencyCircularityMap.get(dependency.propertyKey) || false;
      
        try {
        if (!isCircular) {
          try {
            dependencyValue = container.get(dependency.name);
          } catch {
            dependencyValue = undefined;
          }
          if (dependencyValue !== undefined) {
            resolved = true;
          } else {
            const lazyProxy = createLazyProxy<object>(
              () => container.get(dependency.name, dependency.type) as object,
              `${className}.${dependency.propertyKey} -> ${dependency.name}`
            );
            Object.defineProperty(prototypeChain, dependency.propertyKey, {
              value: lazyProxy, writable: true, enumerable: true, configurable: true
            });
            injectedCount++;
            debugLog(() => `Injected Lazy Proxy for unresolved dependency: ${className}.${dependency.propertyKey} -> ${dependency.name}`);
            continue;
          }
        } else {
          const lazyProxy = createLazyProxy<object>(
            () => container.get(dependency.name, dependency.type) as object,
            `${className}.${dependency.propertyKey} -> ${dependency.name}`
          );
          Object.defineProperty(prototypeChain, dependency.propertyKey, {
            value: lazyProxy, writable: true, enumerable: true, configurable: true
          });
          injectedCount++;
          debugLog(() => `Injected Lazy Proxy for circular dependency: ${className}.${dependency.propertyKey} -> ${dependency.name}`);
          continue;
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
          debugLog(() => `Immediately injected: ${className}.${dependency.propertyKey} = ${dependency.name}`);
        } else {
          // Add to delayed dependencies for later processing
          delayedDependencies.push({
            dependency,
            isCircular
          });
          debugLog(() => `Delayed dependency: ${className}.${dependency.propertyKey} -> ${dependency.name}${isCircular ? ' (circular)' : ' (not available)'}`);
        }
      } catch (error) {
        // If immediate injection fails and is NOT circular, add to delayed dependencies
        // Circular dependencies are already handled with Lazy Proxy above
        if (isCircular) {
          continue;
        }
        delayedDependencies.push({
          dependency,
          isCircular
        });
        debugLog(() => `Failed immediate injection for ${className}.${dependency.propertyKey}, will use delayed loading: ${error}`);
      }
    }
    
    // Step 2: Set up delayed loading for dependencies that couldn't be resolved immediately
    if (delayedDependencies.length > 0) {
      setupDelayedInjection(container, prototypeChain, className, delayedDependencies);
    }

    const injectionTime = Date.now() - injectionStart;
    debugLog(() => `Dependency injection completed for ${className}: ${injectedCount}/${preprocessedData.dependencies.length} dependencies in ${injectionTime}ms`);

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
    debugLog(() => `Cannot setup delayed injection for ${className}: app.on is not available`);
    return;
  }
  
  // Use a unique event handler to avoid duplicates
  const delayedInjectionHandler = () => {
    debugLog(() => `Executing delayed injection for ${className} with ${delayedDependencies.length} dependencies`);
    
    let successfulDelayedInjections = 0;
    let failedInjections = 0;
    
    for (const { dependency } of delayedDependencies) {
      try {
        let delayedValue;
        let injectionSuccessful = false;
        
        // For non-circular delayed dependencies, try normal resolution
        // Note: Circular dependencies are already handled with Lazy Proxy in the main flow
        // and never reach this delayed queue
        try {
          delayedValue = container.get(dependency.name, dependency.type);
          injectionSuccessful = true;
        } catch {
          // Fallback to propertyKey for string-based dependencies
          try {
            delayedValue = container.get(dependency.propertyKey, dependency.type);
            injectionSuccessful = true;
          } catch {
            debugLog(() => `Delayed dependency ${dependency.name} still not available`);
          }
        }
        
        let finalValue: any;
        if (injectionSuccessful && delayedValue !== undefined) {
          finalValue = delayedValue;
        } else {
          finalValue = createLazyProxy<object>(
            () => container.get(dependency.name, dependency.type) as object,
            `${className}.${dependency.propertyKey} -> ${dependency.name} (delayed)`
          );
          debugLog(() => `Created Lazy Proxy for unresolved delayed dependency: ${className}.${dependency.propertyKey} -> ${dependency.name}`);
        }
        
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
          debugLog(() => `Successfully injected delayed dependency: ${className}.${dependency.propertyKey} = ${dependency.name}`);
        } else {
          failedInjections++;
          debugLog(() => `Failed to resolve delayed dependency ${className}.${dependency.propertyKey}, created Lazy Proxy`);
        }
        
      } catch (error) {
        failedInjections++;
        debugLog(() => `Failed to inject delayed dependency ${dependency.name} into ${className}.${dependency.propertyKey}: ${error}`);
        
        try {
          const lazyProxy = createLazyProxy<object>(
            () => container.get(dependency.name, dependency.type) as object,
            `${className}.${dependency.propertyKey} -> ${dependency.name} (error recovery)`
          );
          Object.defineProperty(prototypeChain, dependency.propertyKey, {
            value: lazyProxy,
            writable: true,
            enumerable: true,
            configurable: true
          });
        } catch {
          // Silently handle defineProperty errors
        }
      }
    }
    
    debugLog(() => `Delayed injection completed for ${className}: ${successfulDelayedInjections} successful, ${failedInjections} failed (using Lazy Proxy)`);
  };
  
  // Add event listener for delayed injection
  app.once?.('appReady', delayedInjectionHandler);
  debugLog(() => `Setup delayed injection for ${className} with ${delayedDependencies.length} dependencies`);
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
