/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { DefaultLogger as logger } from "koatty_logger";
import { IOCContainer } from "../container/Container";
import { TAGGED_AOP } from "../container/IContainer";
import { MetadataCache, CacheType } from "../utils/MetadataCache";

/**
 * Interface for aspect instances
 */
export interface IAspect {
  name?: string;
  [key: string]: any; // Allow dynamic method access
}

// Unified cache instance for all AOP operations
const metadataCache = new MetadataCache({
  capacity: 2000,
  defaultTTL: 10 * 60 * 1000, // 10 minutes for AOP cache
  cacheConfigs: {
    [CacheType.AOP_INTERCEPTORS]: { capacity: 500, ttl: 15 * 60 * 1000 },
    [CacheType.METHOD_NAMES]: { capacity: 800, ttl: 20 * 60 * 1000 },
    [CacheType.ASPECT_INSTANCES]: { capacity: 200, ttl: 30 * 60 * 1000 }
  }
});

// AOP statistics tracking
let aopCacheStats = {
  interceptorCacheHits: 0,
  interceptorCacheMisses: 0,
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
  const interceptorStats = stats.byType[CacheType.AOP_INTERCEPTORS] || { hits: 0, misses: 0, hitRate: 0, size: 0 };
  const aspectStats = stats.byType[CacheType.ASPECT_INSTANCES] || { hits: 0, misses: 0, hitRate: 0, size: 0 };
  const methodNamesStats = stats.byType[CacheType.METHOD_NAMES] || { hits: 0, misses: 0, hitRate: 0, size: 0 };
  
  const totalHits = interceptorStats.hits + aspectStats.hits + methodNamesStats.hits;
  const totalMisses = interceptorStats.misses + aspectStats.misses + methodNamesStats.misses;
  const overallHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

  return {
    overallHitRate,
    cacheSize: {
      interceptors: interceptorStats.size,
      aspects: aspectStats.size,
      methodNames: methodNamesStats.size
    },
    hitRates: {
      interceptors: interceptorStats.hitRate,
      aspects: aspectStats.hitRate,
      methodNames: methodNamesStats.hitRate
    },
    memoryUsage: stats.memoryUsage
  };
}

/**
 * Log AOP cache performance
 */
export function logAOPCachePerformance() {
  const stats = getAOPCacheStats();
  logger.Debug(`AOP cache stats - Overall hit rate: ${(stats.overallHitRate * 100).toFixed(2)}%`);
  logger.Debug(`AOP cache stats - Aspects: ${stats.cacheSize.aspects}, Methods: ${stats.cacheSize.methodNames}, Interceptors: ${stats.cacheSize.interceptors}`);
  logger.Debug(`AOP hit rates - Overall: ${(stats.overallHitRate * 100).toFixed(2)}%`);
}

/**
 * Compiled AOP interceptor for optimized runtime execution
 */
interface CompiledAOPInterceptor {
  beforeAspects: {
    aspect: IAspect;
    method: string;
  }[];
  afterAspects: {
    aspect: IAspect;
    method: string;
  }[];
  target: any;
  methodName: string;
  compiled: boolean;
  timestamp: number;
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
 * Get cached interceptor
 */
function getCachedInterceptor(targetKey: string): CompiledAOPInterceptor | undefined {
  if (!isAOPCacheEnabled()) {
    return undefined;
  }

  const cached = metadataCache.getAOPInterceptor<CompiledAOPInterceptor>(targetKey);
  if (cached) {
    aopCacheStats.interceptorCacheHits++;
    return cached;
  }

  aopCacheStats.interceptorCacheMisses++;
  return undefined;
}

/**
 * Cache compiled interceptor
 */
function cacheCompiledInterceptor(targetKey: string, compiled: CompiledAOPInterceptor): void {
  if (isAOPCacheEnabled()) {
    metadataCache.setAOPInterceptor(targetKey, compiled);
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
async function get(aopName: string): Promise<IAspect> {
  let aspect = getCachedAspect(aopName);
  if (aspect) {
    return aspect;
  }

  try {
    aspect = IOCContainer.get(aopName, "COMPONENT");
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
  
  while (currentProto && currentProto !== Object.prototype) {
    const names = Object.getOwnPropertyNames(currentProto);
    for (const name of names) {
      if (name !== 'constructor' && 
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
export function getAOPMethodMetadata(target: any, methodName: string): any[] {
  const className = target.name || target.constructor?.name || 'Anonymous';
  const cacheKey = `aop:${className}:${methodName}`;
  
  if (isAOPCacheEnabled()) {
    const cached = metadataCache.get(CacheType.CLASS_METADATA, cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  const aopMetadata = Reflect.getMetadata(TAGGED_AOP, target, methodName) || [];
  
  if (isAOPCacheEnabled()) {
    metadataCache.set(CacheType.CLASS_METADATA, cacheKey, aopMetadata);
  }
  
  return aopMetadata;
}

/**
 * Execute before aspects
 */
async function executeBefore(target: any, methodName: string, args: any[], aspectData: any[]): Promise<any[]> {
  let currentArgs = args;
  
  for (const data of aspectData) {
    if (data.type === 'Before') {
      try {
        const aspect = await get(data.aopName);
        if (aspect && typeof aspect[data.method] === 'function') {
          const result = await aspect[data.method](target, methodName, currentArgs);
          if (Array.isArray(result)) {
            currentArgs = result;
          }
        }
      } catch (error) {
        logger.Error(`Before aspect execution failed for ${data.aopName}.${data.method}:`, error);
      }
    }
  }
  
  return currentArgs;
}

/**
 * Execute after aspects
 */
async function executeAfter(target: any, methodName: string, result: any, aspectData: any[]): Promise<any> {
  let currentResult = result;
  
  for (const data of aspectData) {
    if (data.type === 'After') {
      try {
        const aspect = await get(data.aopName);
        if (aspect && typeof aspect[data.method] === 'function') {
          const aspectResult = await aspect[data.method](target, methodName, currentResult);
          if (aspectResult !== undefined) {
            currentResult = aspectResult;
          }
        }
      } catch (error) {
        logger.Error(`After aspect execution failed for ${data.aopName}.${data.method}:`, error);
      }
    }
  }
  
  return currentResult;
}

/**
 * Execute around aspects
 */
async function executeAround(target: any, methodName: string, args: any[], aspectData: any[], originalMethod: Function): Promise<any> {
  const aroundAspects = aspectData.filter(data => data.type === 'Around');
  
  if (aroundAspects.length === 0) {
    return await originalMethod.apply(target, args);
  }

  let index = 0;
  
  const proceed = async (modifiedArgs?: any[]): Promise<any> => {
    const currentArgs = modifiedArgs || args;
    
    if (index < aroundAspects.length) {
      const data = aroundAspects[index++];
      try {
        const aspect = await get(data.aopName);
        if (aspect && typeof aspect[data.method] === 'function') {
          return await aspect[data.method](target, methodName, currentArgs, proceed);
        }
      } catch (error) {
        logger.Error(`Around aspect execution failed for ${data.aopName}.${data.method}:`, error);
      }
      return await proceed(currentArgs);
    } else {
      return await originalMethod.apply(target, currentArgs);
    }
  };

  return await proceed();
}

/**
 * Compile AOP interceptor for a target method
 */
function compileAOPInterceptor(target: any, methodName: string): CompiledAOPInterceptor {
  const targetKey = `${target.name || target.constructor?.name}:${methodName}`;
  
  // Check cache first
  const cached = getCachedInterceptor(targetKey);
  if (cached) {
    return cached;
  }

  const aspectData = getAOPMethodMetadata(target, methodName);
  const beforeAspects: any[] = [];
  const afterAspects: any[] = [];

  // Compile aspect metadata
  for (const data of aspectData) {
    try {
      if (data.type === 'Before') {
        beforeAspects.push({
          aspect: null, // Will be resolved at runtime
          method: data.method
        });
      } else if (data.type === 'After') {
        afterAspects.push({
          aspect: null, // Will be resolved at runtime
          method: data.method
        });
      }
    } catch (error) {
      logger.Error(`Failed to compile aspect for ${data.aopName}:`, error);
    }
  }

  const compiled: CompiledAOPInterceptor = {
    beforeAspects,
    afterAspects,
    target,
    methodName,
    compiled: true,
    timestamp: Date.now()
  };

  // Cache the compiled interceptor
  cacheCompiledInterceptor(targetKey, compiled);
  
  logger.Debug(`Compiled AOP interceptor for ${target.name || target.constructor?.name}: ${beforeAspects.length} before, ${afterAspects.length} after aspects`);
  
  return compiled;
}

/**
 * Enhanced AOP method wrapper with compiled interceptors
 */
function defineAOPMethod(target: any, methodName: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  if (typeof originalMethod !== 'function') {
    return descriptor;
  }

  descriptor.value = async function (...args: any[]) {
    const aspectData = getAOPMethodMetadata(target, methodName);
    
    if (!aspectData || aspectData.length === 0) {
      return await originalMethod.apply(this, args);
    }

    try {
      // Execute Before aspects
      const processedArgs = await executeBefore(this, methodName, args, aspectData);
      
      // Execute Around aspects or original method
      let result = await executeAround(this, methodName, processedArgs, aspectData, originalMethod);
      
      // Execute After aspects
      result = await executeAfter(this, methodName, result, aspectData);
      
      return result;
    } catch (error) {
      logger.Error(`AOP method execution failed for ${target.name}.${methodName}:`, error);
      throw error;
    }
  };

  return descriptor;
}

/**
 * Apply AOP to target class
 */
export function injectAOP(target: any): any {
  if (!target?.prototype) {
    return target;
  }

  const methods = getMethodNames(target);
  let aopMethodCount = 0;

  for (const methodName of methods) {
    const aspectData = getAOPMethodMetadata(target, methodName);
    if (aspectData && aspectData.length > 0) {
      const descriptor = Object.getOwnPropertyDescriptor(target.prototype, methodName);
      if (descriptor && descriptor.value) {
        Object.defineProperty(target.prototype, methodName, defineAOPMethod(target, methodName, descriptor));
        aopMethodCount++;
      }
    }
  }

  if (aopMethodCount > 0) {
    logger.Debug(`Applied AOP to ${target.name}: ${aopMethodCount} methods enhanced`);
  }

  return target;
}

/**
 * Clear all AOP caches
 */
export function clearAOPCache(): void {
  metadataCache.clearType(CacheType.AOP_INTERCEPTORS);
  metadataCache.clearType(CacheType.METHOD_NAMES);
  metadataCache.clearType(CacheType.ASPECT_INSTANCES);
  
  // Reset statistics
  aopCacheStats = {
    interceptorCacheHits: 0,
    interceptorCacheMisses: 0,
    aspectCacheHits: 0,
    aspectCacheMisses: 0,
    methodNamesCacheHits: 0,
    methodNamesCacheMisses: 0
  };
  
  logger.Debug('AOP cache cleared');
}

/**
 * Warm up AOP cache for given targets
 */
export function warmupAOPCache(targets: any[]): void {
  const startTime = Date.now();

  for (const target of targets) {
    try {
      const methods = getMethodNames(target);
      for (const methodName of methods) {
        compileAOPInterceptor(target, methodName);
      }
    } catch (error) {
      logger.Error(`Failed to warmup AOP cache for ${target.name}:`, error);
    }
  }

  const warmupTime = Date.now() - startTime;
  logger.Debug(`AOP cache warmed up for ${targets.length} targets in ${warmupTime}ms`);
  
  const stats = getAOPCacheStats();
  logger.Debug(`AOP cache stats - Aspects: ${stats.cacheSize.aspects}, Methods: ${stats.cacheSize.methodNames}, Interceptors: ${stats.cacheSize.interceptors}`);
  logger.Debug(`AOP hit rates - Overall: ${(stats.overallHitRate * 100).toFixed(2)}%`);
}

/**
 * Optimize AOP cache performance
 */
export function optimizeAOPCache(): void {
  metadataCache.optimize();
  
  const stats = getAOPCacheStats();
  logger.Debug(`AOP cache optimized - Overall hit rate: ${(stats.overallHitRate * 100).toFixed(2)}%`);
}

/**
 * Get AOP cache size information
 */
export function getAOPCacheSize(): {
  interceptors: number;
  aspects: number;
  methodNames: number;
} {
  return {
    interceptors: metadataCache.size(CacheType.AOP_INTERCEPTORS),
    aspects: metadataCache.size(CacheType.ASPECT_INSTANCES),
    methodNames: metadataCache.size(CacheType.METHOD_NAMES)
  };
}
