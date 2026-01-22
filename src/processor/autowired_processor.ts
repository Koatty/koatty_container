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
 * Interface for dependency information
 */
interface DependencyInfo {
  name: string;
  propertyKey: string;
  type?: string;
  method?: Function;
  args?: any[];
}

/**
 * Interface for dependency preprocessing data
 */
interface DependencyPreProcessData {
  dependencies: DependencyInfo[];
  processedAt: number;
  target: Function;
}

/**
 * Interface for dependency resolution result
 */
interface ResolutionResult {
  value: any;
  resolved: boolean;
}

/**
 * Track classes that have registered delayed injection to avoid duplicates
 */
const registeredDelayedClasses = new Set<string>();

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
 * Utility function to safely define property on target object
 * 
 * @param target - The target object to define property on
 * @param key - The property key
 * @param value - The property value
 * @returns {boolean} - True if successful, false otherwise
 */
function safeDefineProperty(
  target: object,
  key: string,
  value: any
): boolean {
  try {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return true;
  } catch (error) {
    logger.Debug(`Failed to define property ${key}:`, error);
    return false;
  }
}

/**
 * Resolve a single dependency from the container
 * 
 * @param container - The IoC container
 * @param dependency - The dependency information
 * @param isCircular - Whether this is a circular dependency
 * @returns {ResolutionResult} - The resolution result
 */
function resolveDependency(
  container: IContainer,
  dependency: DependencyInfo,
  isCircular: boolean
): ResolutionResult {
  // Circular dependencies should always use delayed loading
  if (isCircular) {
    return { value: undefined, resolved: false };
  }
  
  try {
    const value = container.get(dependency.name);
    return { value, resolved: value !== undefined };
  } catch {
    return { value: undefined, resolved: false };
  }
}

/**
 * Resolve a delayed dependency with multiple fallback strategies
 * 
 * @param container - The IoC container
 * @param dependency - The dependency information
 * @param isCircular - Whether this is a circular dependency
 * @returns {ResolutionResult} - The resolution result
 */
function resolveDelayedDependency(
  container: IContainer,
  dependency: DependencyInfo,
  isCircular: boolean
): ResolutionResult {
  const strategies = isCircular
    ? [
        // For circular dependencies, use safer getInsByClass approach
        () => {
          const depClass = container.getClass(dependency.name, dependency.type);
          return depClass ? container.getInsByClass(depClass) : undefined;
        },
        () => {
          const depClass = container.getClass(dependency.propertyKey, dependency.type);
          return depClass ? container.getInsByClass(depClass) : undefined;
        }
      ]
    : [
        // For non-circular delayed dependencies, try normal resolution
        () => container.get(dependency.name, dependency.type),
        () => container.get(dependency.propertyKey, dependency.type)
      ];

  for (const strategy of strategies) {
    try {
      const value = strategy();
      if (value !== undefined) {
        return { value, resolved: true };
      }
    } catch {
      // Continue to next strategy
      continue;
    }
  }
  
  return { value: null, resolved: false };
}

/**
 * Check if a specific dependency is part of a circular dependency chain
 * 
 * @param className - The class name
 * @param dependencyName - The dependency name
 * @param allCircularDeps - All detected circular dependency chains
 * @returns {boolean} - True if circular dependency exists
 */
function isCircularDependency(
  className: string,
  dependencyName: string,
  allCircularDeps: string[][]
): boolean {
  return allCircularDeps.some(cycle => {
    const classIndex = cycle.indexOf(className);
    const depIndex = cycle.indexOf(dependencyName);
    
    // Both must be in the same cycle
    if (classIndex === -1 || depIndex === -1) {
      return false;
    }
    
    // Check if they have a direct dependency relationship in the cycle
    // They should be adjacent in the cycle (considering circular nature)
    const cyclePath = [...cycle, cycle[0]]; // Make it circular for easier checking
    for (let i = 0; i < cyclePath.length - 1; i++) {
      if (cyclePath[i] === className && cyclePath[i + 1] === dependencyName) {
        return true;
      }
    }
    
    return false;
  });
}

/**
 * Generate cache key for dependency preprocessing
 * Uses WeakMap internally but this is for backward compatibility
 * 
 * @param className - The class name
 * @param target - The target function
 * @returns {string} - The cache key
 */
function generateCacheKey(className: string, target: Function): string {
  // Use a combination of class name and a more stable identifier
  // Note: In production, consider using WeakMap directly for better stability
  const targetStr = target.toString();
  const hash = targetStr.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `dep_preprocess:${className}:${Math.abs(hash)}`;
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
  const cacheKey = generateCacheKey(className, target);
  
  // Try to get from cache first
  const cached = getCachedDependencyPreprocess(cacheKey);
  if (cached) {
    logger.Debug(`Using cached dependency preprocessing for ${className}`);
    return cached;
  }

  logger.Debug(`Preprocessing dependencies for ${className}`);
  
  const metaData = recursiveGetMetadata(container, TAGGED_PROP, target);
  const dependencies: DependencyInfo[] = [];
  
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
    // Get or preprocess dependencies using updated cache key
    const cacheKey = generateCacheKey(className, target);
    let preprocessedData = getCachedDependencyPreprocess(cacheKey);
    if (!preprocessedData) {
      preprocessedData = preprocessDependencies(target, container);
    }

    if (!preprocessedData.dependencies || preprocessedData.dependencies.length === 0) {
      return;
    }

    let injectedCount = 0;
    const delayedDependencies: Array<{
      dependency: DependencyInfo;
      isCircular: boolean;
    }> = [];
    
    // Step 0: Complete circular dependency detection for ALL dependencies
    const detector = container.getCircularDependencyDetector();
    const allCircularDeps = detector.hasCircularDependencies() ? detector.getAllCircularDependencies() : [];
    
    // Check each dependency for circular relationships using improved detection
    const dependencyCircularityMap = new Map<string, boolean>();
    for (const dependency of preprocessedData.dependencies) {
      if (dependency.name) {
        const isCircular = isCircularDependency(className, dependency.name, allCircularDeps);
        dependencyCircularityMap.set(dependency.propertyKey, isCircular);
        
        if (isCircular) {
          logger.Debug(`Circular dependency detected: ${className}.${dependency.propertyKey} -> ${dependency.name}`);
        }
      }
    }
    
    // Step 1: Process each dependency using unified resolution logic
    for (const dependency of preprocessedData.dependencies) {
      const isCircular = dependencyCircularityMap.get(dependency.propertyKey) || false;
      
      try {
        // Use unified resolution function
        const result = resolveDependency(container, dependency, isCircular);
        
        if (result.resolved && result.value !== undefined) {
          // Immediate injection using safe property definition
          if (safeDefineProperty(prototypeChain, dependency.propertyKey, result.value)) {
            injectedCount++;
            logger.Debug(`Immediately injected: ${className}.${dependency.propertyKey} = ${dependency.name}`);
          } else {
            // If property definition failed, add to delayed dependencies
            delayedDependencies.push({ dependency, isCircular });
          }
        } else {
          // Add to delayed dependencies for later processing
          delayedDependencies.push({ dependency, isCircular });
          logger.Debug(`Delayed dependency: ${className}.${dependency.propertyKey} -> ${dependency.name}${isCircular ? ' (circular)' : ' (not available)'}`);
        }
      } catch (error) {
        // If immediate injection fails, add to delayed dependencies
        delayedDependencies.push({ dependency, isCircular });
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
 * 
 * Improvements:
 * - Uses 'once' instead of 'on' to prevent duplicate execution
 * - Adds timeout protection (30 seconds)
 * - Checks if app is already ready
 * - Prevents duplicate registrations per class
 * - Uses utility functions for cleaner code
 */
function setupDelayedInjection(
  container: IContainer, 
  prototypeChain: object, 
  className: string,
  delayedDependencies: Array<{
    dependency: DependencyInfo;
    isCircular: boolean;
  }>
): void {
  const app = container.getApp();
  if (!app || typeof app.on !== 'function') {
    logger.Debug(`Cannot setup delayed injection for ${className}: app.on is not available`);
    return;
  }
  
  // Prevent duplicate registration for the same class
  if (registeredDelayedClasses.has(className)) {
    logger.Debug(`Delayed injection already registered for ${className}, skipping duplicate`);
    return;
  }
  registeredDelayedClasses.add(className);
  
  // Define the injection handler
  const delayedInjectionHandler = () => {
    logger.Debug(`Executing delayed injection for ${className} with ${delayedDependencies.length} dependencies`);
    
    let successfulDelayedInjections = 0;
    let failedInjections = 0;
    
    for (const { dependency, isCircular } of delayedDependencies) {
      try {
        // Use unified delayed resolution function
        const result = resolveDelayedDependency(container, dependency, isCircular);
        const finalValue = result.resolved && result.value !== undefined ? result.value : null;
        
        // Use safe property definition
        if (safeDefineProperty(prototypeChain, dependency.propertyKey, finalValue)) {
          // Additionally, fix existing instances if they have undefined properties
          try {
            const targetClass = container.getClass(className);
            if (targetClass) {
              const instance = container.getInsByClass(targetClass);
              if (instance && (instance as any)[dependency.propertyKey] === undefined) {
                (instance as any)[dependency.propertyKey] = finalValue;
              }
            }
          } catch {
            // Silently handle any errors in instance property setting
          }
          
          if (result.resolved) {
            successfulDelayedInjections++;
            logger.Debug(`Successfully injected delayed dependency: ${className}.${dependency.propertyKey} = ${dependency.name}`);
          } else {
            failedInjections++;
            logger.Debug(`Failed to resolve delayed dependency ${className}.${dependency.propertyKey}, set to null`);
          }
        } else {
          failedInjections++;
          logger.Debug(`Failed to define property for delayed dependency ${className}.${dependency.propertyKey}`);
        }
        
      } catch (error) {
        failedInjections++;
        logger.Debug(`Failed to inject delayed dependency ${dependency.name} into ${className}.${dependency.propertyKey}:`, error);
        
        // Even on error, try to set property to null to ensure it exists
        safeDefineProperty(prototypeChain, dependency.propertyKey, null);
      }
    }
    
    logger.Debug(`Delayed injection completed for ${className}: ${successfulDelayedInjections} successful, ${failedInjections} failed (set to null)`);
  };
  
  // Check if app is already ready
  if ((app as any).isReady) {
    logger.Debug(`App already ready, executing delayed injection immediately for ${className}`);
    delayedInjectionHandler();
    return;
  }
  
  // Set up timeout protection (30 seconds)
  const timeoutMs = 30000;
  let timeoutHandle: NodeJS.Timeout | undefined;
  
  const executeWithCleanup = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    }
    delayedInjectionHandler();
  };
  
  // Use 'once' to prevent duplicate execution
  if (typeof app.once === 'function') {
    app.once('appReady', executeWithCleanup);
  } else {
    // Fallback to 'on' if 'once' is not available
    app.on('appReady', executeWithCleanup);
  }
  
  // Set up timeout as fallback
  timeoutHandle = setTimeout(() => {
    logger.Warn(`Delayed injection timeout (${timeoutMs}ms) for ${className}, attempting injection anyway`);
    delayedInjectionHandler();
  }, timeoutMs);
  
  logger.Debug(`Setup delayed injection for ${className} with ${delayedDependencies.length} dependencies (timeout: ${timeoutMs}ms)`);
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
  registeredDelayedClasses.clear(); // Also clear delayed injection registry
  logger.Debug('Dependency preprocessing cache and delayed injection registry cleared');
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
