/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { DefaultLogger as logger } from "koatty_logger";
import { IOCContainer } from "../container/Container";
import { IAspect, TAGGED_AOP, TAGGED_CLS } from "../container/IContainer";
import { MetadataCache, CacheType } from "../utils/MetadataCache";

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
  const totalRequests = totalHits + totalMisses;
  const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

  return {
    overallHitRate,
    cacheSize: {
      interceptors: interceptorStats.size,
      aspects: aspectStats.size,
      methodNames: methodNamesStats.size
    },
    hitRates: {
      interceptors: interceptorStats.hitRate || 0,
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
  const cacheKey = `aop:${target.name}:${methodName}`;
  
  // Check cache first
  const cached = metadataCache.get(CacheType.CLASS_METADATA, cacheKey);
  if (cached) {
    return cached;
  }

  // Get class AOP data
  const classAOPData = IOCContainer.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) || [];

  // Get method-specific AOP data
  const methodAOPData = IOCContainer.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target, methodName) || [];

  // Combine and filter metadata
  const aopMetadata: any[] = [];

  // Add method-specific metadata first (higher priority)
  for (const data of methodAOPData) {
    if (data.method === methodName) {
      aopMetadata.push({
        type: data.type,
        aopName: data.name,
        method: "run",
        order: data.order || 0
      });
    }
  }

  // Add class-level metadata for methods that match the criteria
  for (const data of classAOPData) {
    // For AroundEach, BeforeEach, AfterEach - apply to all methods
    if (['AroundEach', 'BeforeEach', 'AfterEach'].includes(data.type)) {
      aopMetadata.push({
        type: data.type,
        aopName: data.name,
        method: "run",
        order: data.order || 0
      });
    }
    // For Around, Before, After - only apply to specific methods
    else if (['Around', 'Before', 'After'].includes(data.type) && data.method === methodName) {
      aopMetadata.push({
        type: data.type,
        aopName: data.name,
        method: "run",
        order: data.order || 0
      });
    }
  }

  // Sort by order to preserve decorator declaration order
  aopMetadata.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Cache the result
  metadataCache.set(CacheType.CLASS_METADATA, cacheKey, aopMetadata);

  return aopMetadata;
}

/**
 * Execute before aspects
 */
async function executeBefore(target: any, methodName: string, args: any[], aspectData: any[]): Promise<any[]> {
  for (const data of aspectData) {
    if (data.type === 'Before' || data.type === 'BeforeEach') {
      try {
        const aspect = await get(data.aopName);
        if (aspect && typeof aspect.run === 'function') {
          // Call aspect.run with only args parameter for simplicity
          await aspect.run(args);
          // Before aspects typically don't modify arguments
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
async function executeAfter(target: any, methodName: string, result: any, aspectData: any[], originalArgs?: any[]): Promise<any> {
  for (const data of aspectData) {
    if (data.type === 'After' || data.type === 'AfterEach') {
      try {
        const aspect = await get(data.aopName);
        if (aspect && typeof aspect.run === 'function') {
          // Call aspect.run with only args parameter for simplicity
          await aspect.run(originalArgs || []);
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
async function executeAround(target: any, methodName: string, args: any[], aspectData: any[], originalMethod: Function): Promise<any> {
  const aroundAspects = aspectData.filter(data => data.type === 'Around' || data.type === 'AroundEach');
  
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
        if (aspect && typeof aspect.run === 'function') {
          // Call aspect.run with only args and proceed parameters for simplicity
          return await aspect.run(currentArgs, proceed);
        }
      } catch (error) {
        logger.Error(`Around aspect execution failed for ${data.aopName}:`, error);
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
 * Enhanced AOP method wrapper with compiled interceptors and proper priority handling
 * __before and __after have the highest priority and are mutually exclusive with @BeforeEach/@AfterEach
 * 
 * Execution order:
 * 1. __before (if exists) - mutually exclusive with @BeforeEach
 * 2. @Before aspects
 * 3. @BeforeEach aspects (only if __before doesn't exist)
 * 4. @Around aspects or original method
 * 5. @AfterEach aspects (only if __after doesn't exist)
 * 6. @After aspects
 * 7. __after (if exists) - mutually exclusive with @AfterEach
 */
function defineAOPMethod(target: any, methodName: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  if (typeof originalMethod !== 'function') {
    return descriptor;
  }

  descriptor.value = async function (...args: any[]) {
    const aspectData = getAOPMethodMetadata(target, methodName);
    
    try {
      // Check for __before method - highest priority, mutually exclusive with @BeforeEach
      const hasDefaultBefore = typeof this.__before === 'function';
      
      // 1. Execute __before if exists (highest priority, always first)
      if (hasDefaultBefore) {
        await this.__before();
      }
      
      // 2. Execute @Before aspects
      let processedArgs = args;
      const beforeAspects = aspectData.filter(data => data.type === 'Before');
      if (beforeAspects.length > 0) {
        processedArgs = await executeBefore(this, methodName, args, beforeAspects);
      }
      
      // 3. Execute BeforeEach aspects only if __before doesn't exist (mutually exclusive)
      if (!hasDefaultBefore) {
        const beforeEachAspects = aspectData.filter(data => data.type === 'BeforeEach');
        if (beforeEachAspects.length > 0) {
          processedArgs = await executeBefore(this, methodName, processedArgs, beforeEachAspects);
        }
      }
      
      // 4. Execute Around aspects or original method
      let result = await executeAround(this, methodName, processedArgs, aspectData, originalMethod);
      
      // Check for __after method - highest priority, mutually exclusive with @AfterEach
      const hasDefaultAfter = typeof this.__after === 'function';
      
      // 5. Execute AfterEach aspects only if __after doesn't exist (mutually exclusive)
      if (!hasDefaultAfter) {
        const afterEachAspects = aspectData.filter(data => data.type === 'AfterEach');
        if (afterEachAspects.length > 0) {
          result = await executeAfter(this, methodName, result, afterEachAspects, args);
        }
      }
      
      // 6. Execute @After aspects
      const afterAspects = aspectData.filter(data => data.type === 'After');
      if (afterAspects.length > 0) {
        result = await executeAfter(this, methodName, result, afterAspects, args);
      }
      
      // 7. Execute __after if exists (highest priority, always last)
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

/**
 * Apply AOP to target class
 */
export function injectAOP(target: any): any {
  if (!target?.prototype) {
    return target;
  }

  // Check if AOP has already been applied to prevent duplicate application
  if (target.prototype.__aopApplied) {
    logger.Debug(`AOP already applied to ${target.name}, skipping duplicate application`);
    return target;
  }

  const methods = getMethodNames(target);
  let aopMethodCount = 0;

  for (const methodName of methods) {
    // Skip special AOP lifecycle methods to prevent infinite recursion
    if (methodName === '__before' || methodName === '__after') {
      continue;
    }
    
    const aspectData = getAOPMethodMetadata(target, methodName);
    const hasAspectsOrDefaults = aspectData.length > 0 || 
      (target.prototype.__before && typeof target.prototype.__before === 'function') ||
      (target.prototype.__after && typeof target.prototype.__after === 'function');
    
    if (hasAspectsOrDefaults) {
      const descriptor = Object.getOwnPropertyDescriptor(target.prototype, methodName);
      if (descriptor && descriptor.value) {
        Object.defineProperty(target.prototype, methodName, defineAOPMethod(target, methodName, descriptor));
        aopMethodCount++;
      }
    }
  }

  // Mark AOP as applied to prevent duplicate application
  Object.defineProperty(target.prototype, '__aopApplied', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false
  });

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
