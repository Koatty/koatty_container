/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { DefaultLogger as logger } from "koatty_logger";
import { IContainer, IAspect, TAGGED_AOP, TAGGED_CLS } from "../container/icontainer";
import { MetadataCache, CacheType } from "../utils/cache";
import { debugLog } from "../utils/debug";

// Unified shared cache instance for all AOP operations
const metadataCache = MetadataCache.getShared();

// AOP statistics tracking
let aopCacheStats = {
  aspectCacheHits: 0,
  aspectCacheMisses: 0,
  methodNamesCacheHits: 0,
  methodNamesCacheMisses: 0
};

/**
 * Check if AOP cache is enabled
 */
function isAOPCacheEnabled(): boolean {
  return process.env.KOATTY_CONTAINER_ENABLE_AOP_CACHE !== 'false';
}

/**
 * Get AOP cache statistics with detailed metrics
 */
export function getAOPCacheStats() {
  const stats = metadataCache.getStats();

  // Calculate hit rates for different cache types
  const aspectStats = stats.byType[CacheType.ASPECT_INSTANCES] || { hits: 0, misses: 0, hitRate: 0, size: 0 };
  const methodNamesStats = stats.byType[CacheType.METHOD_NAMES] || { hits: 0, misses: 0, hitRate: 0, size: 0 };

  const totalHits = aspectStats.hits + methodNamesStats.hits;
  const totalMisses = aspectStats.misses + methodNamesStats.misses;
  const totalRequests = totalHits + totalMisses;
  const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

  return {
    overallHitRate,
    cacheSize: {
      aspects: aspectStats.size,
      methodNames: methodNamesStats.size
    },
    hitRates: {
      aspects: aspectStats.hitRate || 0,
      methodNames: methodNamesStats.hitRate || 0,
      overall: overallHitRate
    },
    memoryUsage: stats.memoryUsage
  };
}

/**
 * Log AOP cache performance
 */
export function logAOPCachePerformance() {
  const stats = getAOPCacheStats();
  debugLog(() => `AOP cache stats - Overall hit rate: ${(stats.overallHitRate * 100).toFixed(2)}%`);
  debugLog(() => `AOP cache stats - Aspects: ${stats.cacheSize.aspects}, Methods: ${stats.cacheSize.methodNames}`);
  debugLog(() => `AOP hit rates - Overall: ${(stats.overallHitRate * 100).toFixed(2)}%`);
}

/**
 * Get cached aspect instance
 */
function getCachedAspect(aopName: string): IAspect | undefined {
  if (!isAOPCacheEnabled()) {
    return undefined;
  }

  const aspect = metadataCache.getAspectInstance<IAspect>(aopName);
  if (aspect) {
    aopCacheStats.aspectCacheHits++;
    return aspect;
  }

  aopCacheStats.aspectCacheMisses++;
  return undefined;
}

/**
 * Cache aspect instance
 */
function cacheAspectInstance(aopName: string, aspect: IAspect): void {
  if (isAOPCacheEnabled()) {
    metadataCache.setAspectInstance(aopName, aspect);
  }
}

/**
 * Get cached method names
 */
function getCachedMethodNames(targetKey: string): string[] | undefined {
  if (!isAOPCacheEnabled()) {
    return undefined;
  }

  const methods = metadataCache.getMethodNames(targetKey);
  if (methods) {
    aopCacheStats.methodNamesCacheHits++;
    return methods;
  }

  aopCacheStats.methodNamesCacheMisses++;
  return undefined;
}

/**
 * Cache method names
 */
function cacheMethodNames(targetKey: string, methods: string[]): void {
  if (isAOPCacheEnabled()) {
    metadataCache.setMethodNames(targetKey, methods);
  }
}

/**
 * Get aspect instance with caching
 */
async function resolveAspect(aopName: string, container: IContainer): Promise<IAspect> {
  let aspect = getCachedAspect(aopName);
  if (aspect) {
    return aspect;
  }

  try {
    aspect = container.get(aopName, "COMPONENT");
    if (aspect) {
      cacheAspectInstance(aopName, aspect);
      return aspect;
    }
  } catch (error) {
    logger.Error(`Failed to get aspect ${aopName}:`, error);
    throw error;
  }

  throw new Error(`Aspect ${aopName} not found`);
}

/**
 * Get all methods of a target class/object with caching
 * Excludes constructor, init, __before, __after methods for BeforeEach/AfterEach/AroundEach decorators
 */
function getMethodNames(target: any): string[] {
  const targetKey = target.name || target.constructor?.name || 'Anonymous';

  // Try to get from cache first
  const cachedMethods = getCachedMethodNames(targetKey);
  if (cachedMethods) {
    return cachedMethods;
  }

  // Compute method names
  const methods: string[] = [];
  let currentProto = target.prototype || target;

  // excluded methods (according to rule 2: constructor, init, before, _after excepted)
  const excludedMethods = ['constructor', 'init', 'before', '_after', '__before', '__after'];

  while (currentProto && currentProto !== Object.prototype) {
    const names = Object.getOwnPropertyNames(currentProto);
    for (const name of names) {
      if (!excludedMethods.includes(name) &&
        typeof currentProto[name] === 'function' &&
        !methods.includes(name)) {
        methods.push(name);
      }
    }
    currentProto = Object.getPrototypeOf(currentProto);
  }

  // Cache the result
  cacheMethodNames(targetKey, methods);
  return methods;
}

/**
 * Get AOP metadata for a method with enhanced caching
 */
export function getAOPMethodMetadata(target: any, methodName: string, container?: IContainer): any[] {
  const cacheKey = `aop:${target.name}:${methodName}`;

  const cached = metadataCache.get(CacheType.CLASS_METADATA, cacheKey);
  if (cached) {
    return cached;
  }

  const classAOPData = container?.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) || [];

  const methodAOPData = container?.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target, methodName) || [];

  debugLog(() => `Processing AOP metadata for ${target.name}.${methodName}:`);
  debugLog(() => `  Class AOP data: ${JSON.stringify(classAOPData)}`);
  debugLog(() => `  Method AOP data: ${JSON.stringify(methodAOPData)}`);

  // Use Map to store only the last decorator of each type for each cut point
  const methodLevelDecorators = new Map<string, any>();
  const classLevelDecorators = new Map<string, any>();

  // Process method-specific metadata first (higher priority)
  // methodAOPData is now an array, process each item
  for (const data of methodAOPData) {
    if (data.method === methodName) {
      // For method-level decorators, later decorators override earlier ones
      const currentData = {
        type: data.type,
        aopName: data.name,
        method: methodName, // target method name, let the aspect know which method is being intercepted
        options: data.options
      };

      const existingData = methodLevelDecorators.get(data.type);
      debugLog(() => `  Method-level ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      methodLevelDecorators.set(data.type, currentData);
      if (existingData) {
        debugLog(() => `    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        debugLog(() => `    -> Using ${data.name} (first occurrence)`);
      }
    }
  }

  // Process class-level metadata
  // classAOPData is now an array, process each item
  for (const data of classAOPData) {
    // For AroundEach, BeforeEach, AfterEach - apply to all methods
    if (['AroundEach', 'BeforeEach', 'AfterEach'].includes(data.type)) {
      // For class-level decorators, later decorators override earlier ones
      const currentData = {
        type: data.type,
        aopName: data.name,
        method: methodName, // target method name, let the aspect know which method is being intercepted
        options: data.options
      };

      const existingData = classLevelDecorators.get(data.type);
      debugLog(() => `  Class-level ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      classLevelDecorators.set(data.type, currentData);
      if (existingData) {
        debugLog(() => `    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        debugLog(() => `    -> Using ${data.name} (first occurrence)`);
      }
    }
    // For Around, Before, After - only apply to specific methods
    else if (['Around', 'Before', 'After'].includes(data.type) && data.method === methodName) {
      // For method-level decorators from class metadata, later decorators override earlier ones
      const currentData = {
        type: data.type,
        aopName: data.name,
        method: methodName, // target method name, let the aspect know which method is being intercepted
        options: data.options
      };

      const existingData = methodLevelDecorators.get(data.type);
      debugLog(() => `  Method-level from class ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      methodLevelDecorators.set(data.type, currentData);
      if (existingData) {
        debugLog(() => `    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        debugLog(() => `    -> Using ${data.name} (first occurrence)`);
      }
    }
  }

  // Combine all decorators, method-level takes precedence over class-level
  const aopMetadata: any[] = [];

  // Add method-level decorators
  for (const decorator of methodLevelDecorators.values()) {
    aopMetadata.push(decorator);
  }

  // Add class-level decorators (only if method-level doesn't have the same type)
  for (const decorator of classLevelDecorators.values()) {
    if (!methodLevelDecorators.has(decorator.type)) {
      aopMetadata.push(decorator);
    }
  }

  debugLog(() => `  Final AOP metadata: ${JSON.stringify(aopMetadata)}`);

  // Cache the result
  metadataCache.set(CacheType.CLASS_METADATA, cacheKey, aopMetadata);

  return aopMetadata;
}

/**
 * Execute before aspects
 */
async function executeBefore(target: any, methodName: string, args: any[], aspectData: any[], container?: IContainer): Promise<any[]> {
  for (const data of aspectData) {
    if (data.type === 'Before' || data.type === 'BeforeEach') {
      try {
        if (container) {
          const aspect = await resolveAspect(data.aopName, container);
          if (aspect && typeof aspect.run === 'function') {
            const enhancedOptions = {
              ...data.options,
              targetMethod: data.method || methodName,
              target
            };
            await aspect.run(args, undefined, enhancedOptions);
          }
        }
      } catch (error) {
        logger.Error(`Before aspect execution failed for ${data.aopName}:`, error);
      }
    }
  }

  return args;
}

/**
 * Execute after aspects
 */
async function executeAfter(target: any, methodName: string, result: any, aspectData: any[], originalArgs?: any[], container?: IContainer): Promise<any> {
  for (const data of aspectData) {
    if (data.type === 'After' || data.type === 'AfterEach') {
      try {
        if (container) {
          const aspect = await resolveAspect(data.aopName, container);
          if (aspect && typeof aspect.run === 'function') {
            const enhancedOptions = {
              ...data.options,
              targetMethod: data.method || methodName,
              target
            };
            await aspect.run(originalArgs || [], undefined, enhancedOptions);
          }
        }
      } catch (error) {
        logger.Error(`After aspect execution failed for ${data.aopName}:`, error);
      }
    }
  }

  return result;
}

/**
 * Execute around aspects
 */
async function executeAround(target: any, methodName: string, args: any[], aspectData: any[], originalMethod: Function, container?: IContainer): Promise<any> {
  const aroundAspects = aspectData.filter(data => data.type === 'Around' || data.type === 'AroundEach');

  if (aroundAspects.length === 0) {
    return await originalMethod.apply(target, args);
  }

  const selectedAspect = aroundAspects[aroundAspects.length - 1];

  try {
    if (container) {
      const aspect = await resolveAspect(selectedAspect.aopName, container);
      if (aspect && typeof aspect.run === 'function') {
        const proceed = async (...modifiedArgs: unknown[]): Promise<unknown> => {
          const finalArgs = modifiedArgs.length > 0 ? modifiedArgs : args;
          return await originalMethod.apply(target, finalArgs);
        };

        const enhancedOptions = {
          ...selectedAspect.options,
          targetMethod: selectedAspect.method || methodName,
          target
        };

        return await aspect.run(args, proceed, enhancedOptions);
      }
    }
  } catch (error) {
    logger.Error(`Around aspect execution failed for ${selectedAspect.aopName}:`, error);
  }

  return await originalMethod.apply(target, args);
}

function defineAOPMethod(target: any, methodName: string, descriptor: PropertyDescriptor, container?: IContainer) {
  const originalMethod = descriptor.value;
  if (typeof originalMethod !== 'function') {
    return descriptor;
  }

  descriptor.value = async function (this: any, ...args: any[]) {
    const aspectData = getAOPMethodMetadata(target, methodName, container);

    try {
      const hasDefaultBefore = typeof this.__before === 'function';
      const hasBeforeEach = aspectData.some(data => data.type === 'BeforeEach');

      const hasDefaultAfter = typeof this.__after === 'function';
      const hasAfterEach = aspectData.some(data => data.type === 'AfterEach');

      if (hasDefaultBefore && hasBeforeEach) {
        logger.Warn(`__before and @BeforeEach both detected on ${target.name}.${methodName}, __before takes priority and @BeforeEach will be ignored`);
      }

      if (hasDefaultAfter && hasAfterEach) {
        logger.Warn(`__after and @AfterEach both detected on ${target.name}.${methodName}, __after takes priority and @AfterEach will be ignored`);
      }

      if (hasDefaultBefore) {
        await this.__before();
      }

      let processedArgs = args;
      const beforeAspects = aspectData.filter(data => data.type === 'Before');
      if (beforeAspects.length > 0) {
        processedArgs = await executeBefore(this, methodName, args, beforeAspects, container);
      }

      if (!hasDefaultBefore) {
        const beforeEachAspects = aspectData.filter(data => data.type === 'BeforeEach');
        if (beforeEachAspects.length > 0) {
          processedArgs = await executeBefore(this, methodName, processedArgs, beforeEachAspects, container);
        }
      }

      let result = await executeAround(this, methodName, processedArgs, aspectData, originalMethod, container);

      if (!hasDefaultAfter) {
        const afterEachAspects = aspectData.filter(data => data.type === 'AfterEach');
        if (afterEachAspects.length > 0) {
          result = await executeAfter(this, methodName, result, afterEachAspects, args, container);
        }
      }

      const afterAspects = aspectData.filter(data => data.type === 'After');
      if (afterAspects.length > 0) {
        result = await executeAfter(this, methodName, result, afterAspects, args, container);
      }

      if (hasDefaultAfter) {
        await this.__after();
      }

      return result;
    } catch (error) {
      logger.Error(`AOP method execution failed for ${target.name}.${methodName}:`, error);
      throw error;
    }
  };

  return descriptor;
}

export function injectAOP(target: any, container?: IContainer): any {
  if (!target?.prototype) {
    return target;
  }

  if (target.prototype.__aopApplied) {
    debugLog(() => `AOP already applied to ${target.name}, skipping duplicate application`);
    return target;
  }

  const methods = getMethodNames(target);
  let aopMethodCount = 0;

  for (const methodName of methods) {
    if (methodName === '__before' || methodName === '__after') {
      continue;
    }

    const aspectData = getAOPMethodMetadata(target, methodName, container);

    const hasBuiltinBefore = typeof target.prototype.__before === 'function' ||
      Object.prototype.hasOwnProperty.call(target.prototype, '__before');
    const hasBuiltinAfter = typeof target.prototype.__after === 'function' ||
      Object.prototype.hasOwnProperty.call(target.prototype, '__after');

    const hasAspectsOrDefaults = aspectData.length > 0 || hasBuiltinBefore || hasBuiltinAfter;

    if (hasAspectsOrDefaults) {
      const descriptor = Object.getOwnPropertyDescriptor(target.prototype, methodName);
      if (descriptor && descriptor.value) {
        Object.defineProperty(target.prototype, methodName, defineAOPMethod(target, methodName, descriptor, container));
        aopMethodCount++;

        if (hasBuiltinBefore || hasBuiltinAfter) {
          debugLog(() => `Applied AOP to ${target.name}.${methodName} with built-in methods: __before=${hasBuiltinBefore}, __after=${hasBuiltinAfter}`);
        }
      }
    }
  }

  Object.defineProperty(target.prototype, '__aopApplied', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false
  });

  if (aopMethodCount > 0) {
    debugLog(() => `Applied AOP to ${target.name}: ${aopMethodCount} methods enhanced`);
  }

  return target;
}

/**
 * Clear all AOP caches
 */
export function clearAOPCache(): void {
  metadataCache.clearType(CacheType.METHOD_NAMES);
  metadataCache.clearType(CacheType.ASPECT_INSTANCES);

  // Reset statistics
  aopCacheStats = {
    aspectCacheHits: 0,
    aspectCacheMisses: 0,
    methodNamesCacheHits: 0,
    methodNamesCacheMisses: 0
  };

  debugLog(() => 'AOP cache cleared');
}

export function warmupAOPCache(targets: any[], container?: IContainer): void {
  const startTime = Date.now();

  for (const target of targets) {
    try {
      const methods = getMethodNames(target);
      for (const methodName of methods) {
        getAOPMethodMetadata(target, methodName, container);
      }
    } catch (error) {
      logger.Error(`Failed to warmup AOP cache for ${target.name}:`, error);
    }
  }

  const warmupTime = Date.now() - startTime;
  debugLog(() => `AOP cache warmed up for ${targets.length} targets in ${warmupTime}ms`);

  const stats = getAOPCacheStats();
  debugLog(() => `AOP cache stats - Aspects: ${stats.cacheSize.aspects}, Methods: ${stats.cacheSize.methodNames}`);
  debugLog(() => `AOP hit rates - Overall: ${(stats.overallHitRate * 100).toFixed(2)}%`);
}

/**
 * Optimize AOP cache performance
 */
export function optimizeAOPCache(): void {
  metadataCache.optimize();

  const stats = getAOPCacheStats();
  debugLog(() => `AOP cache optimized - Overall hit rate: ${(stats.overallHitRate * 100).toFixed(2)}%`);
}

/**
 * Get AOP cache size information
 */
export function getAOPCacheSize(): {
  aspects: number;
  methodNames: number;
} {
  return {
    aspects: metadataCache.size(CacheType.ASPECT_INSTANCES),
    methodNames: metadataCache.size(CacheType.METHOD_NAMES)
  };
}
