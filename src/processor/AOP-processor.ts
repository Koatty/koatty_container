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
import { LRUCache } from "lru-cache";
import {
  AOPType, IAspect, IContainer, ObjectDefinitionOptions,
  TAGGED_AOP, TAGGED_CLS
} from "../container/IContainer";
import { getMethodNames } from "../utils/MetadataOpertor";

// Aspect instance cache
const aspectInstanceCache = new LRUCache<string, IAspect>({
  max: 500,  // max size
  ttl: 10 * 60 * 1000, // 10 minutes ttl
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: false,
});

const methodNamesCache = new LRUCache<string, string[]>({
  max: 1000, // max size
  ttl: 15 * 60 * 1000, // 15 minutes ttl
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: false,
});

// compiled aop interceptor
interface CompiledAOPInterceptor {
  beforeAspects: IAspect[];
  afterAspects: IAspect[];
  hasDefaultBefore: boolean;
  hasDefaultAfter: boolean;
}

const compiledInterceptors = new LRUCache<string, CompiledAOPInterceptor>({
  max: 800, // max size
  ttl: 20 * 60 * 1000, // 20 minutes ttl
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: false,
});

// aop cache stats
let aopCacheStats = {
  aspectCacheHits: 0,
  aspectCacheMisses: 0,
  methodNamesCacheHits: 0,
  methodNamesCacheMisses: 0,
  interceptorCacheHits: 0,
  interceptorCacheMisses: 0,
  totalRequests: 0
};

/**
 * get aop cache stats
 */
export function getAOPCacheStats(): {
  cacheSize: {
    aspects: number;
    methodNames: number;
    interceptors: number;
  };
  stats: typeof aopCacheStats;
  hitRates: {
    aspect: number;
    methodNames: number;
    interceptor: number;
    overall: number;
  };
} {
  const aspectHitRate = (aopCacheStats.aspectCacheHits + aopCacheStats.aspectCacheMisses) > 0 
    ? aopCacheStats.aspectCacheHits / (aopCacheStats.aspectCacheHits + aopCacheStats.aspectCacheMisses) : 0;
  
  const methodNamesHitRate = (aopCacheStats.methodNamesCacheHits + aopCacheStats.methodNamesCacheMisses) > 0 
    ? aopCacheStats.methodNamesCacheHits / (aopCacheStats.methodNamesCacheHits + aopCacheStats.methodNamesCacheMisses) : 0;
  
  const interceptorHitRate = (aopCacheStats.interceptorCacheHits + aopCacheStats.interceptorCacheMisses) > 0 
    ? aopCacheStats.interceptorCacheHits / (aopCacheStats.interceptorCacheHits + aopCacheStats.interceptorCacheMisses) : 0;
  
  const totalHits = aopCacheStats.aspectCacheHits + aopCacheStats.methodNamesCacheHits + aopCacheStats.interceptorCacheHits;
  const totalMisses = aopCacheStats.aspectCacheMisses + aopCacheStats.methodNamesCacheMisses + aopCacheStats.interceptorCacheMisses;
  const overallHitRate = (totalHits + totalMisses) > 0 ? totalHits / (totalHits + totalMisses) : 0;

  return {
    cacheSize: {
      aspects: aspectInstanceCache.size,
      methodNames: methodNamesCache.size,
      interceptors: compiledInterceptors.size
    },
    stats: aopCacheStats,
    hitRates: {
      aspect: aspectHitRate,
      methodNames: methodNamesHitRate,
      interceptor: interceptorHitRate,
      overall: overallHitRate
    }
  };
}

/**
 * compile aop interceptor
 * @param target target class
 * @param container container
 */
function compileAOPInterceptor(target: Function, container: IContainer): CompiledAOPInterceptor {
  const targetKey = `${target.name}_${target.toString().length}`;
  
  // check lru cache
  const cached = compiledInterceptors.get(targetKey);
  if (cached) {
    aopCacheStats.interceptorCacheHits++;
    return cached;
  }
  
  aopCacheStats.interceptorCacheMisses++;
  
  const beforeAspects: IAspect[] = [];
  const afterAspects: IAspect[] = [];
  
  // check default aop method
  const allMethods = getCachedMethodNames(target);
  const hasDefaultBefore = allMethods.includes('__before');
  const hasDefaultAfter = allMethods.includes('__after');
  
  // get aop metadata
  const classMetaDatas: any[] = container.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) ?? [];
  
  // pre-parse all aspect instances
  for (const { type, name } of classMetaDatas) {
    if (name && [AOPType.Before, AOPType.BeforeEach, AOPType.After, AOPType.AfterEach].includes(type)) {
      const aspect = getCachedAspect(container, name);
      if (aspect) {
        if ([AOPType.Before, AOPType.BeforeEach].includes(type)) {
          beforeAspects.push(aspect);
        } else {
          afterAspects.push(aspect);
        }
      }
    }
  }
  
  const compiled: CompiledAOPInterceptor = {
    beforeAspects,
    afterAspects,
    hasDefaultBefore,
    hasDefaultAfter
  };
  
  // store to lru cache
  compiledInterceptors.set(targetKey, compiled);
  logger.Debug(`Compiled AOP interceptor for ${target.name}: ${beforeAspects.length} before, ${afterAspects.length} after aspects`);
  
  return compiled;
}

/**
 * get cached method names
 */
function getCachedMethodNames(target: Function): string[] {
  const targetKey = `${target.name}_${target.toString().length}`;
  
  let methods = methodNamesCache.get(targetKey);
  if (methods) {
    aopCacheStats.methodNamesCacheHits++;
    return methods;
  }
  
  aopCacheStats.methodNamesCacheMisses++;
  methods = getMethodNames(target);
  methodNamesCache.set(targetKey, methods);
  
  return methods;
}

/**
 * get cached aspect instance
 */
function getCachedAspect(container: IContainer, aopName: string): IAspect | null {
  // check lru cache
  let aspect = aspectInstanceCache.get(aopName);
  
  if (aspect) {
    aopCacheStats.aspectCacheHits++;
    return aspect;
  }
  
  aopCacheStats.aspectCacheMisses++;
  
  try {
    aspect = container.get(aopName, "COMPONENT");
    if (aspect && helper.isFunction(aspect.run)) {
      aspectInstanceCache.set(aopName, aspect);
    } else {
      logger.Warn(`Invalid aspect ${aopName}: missing run method`);
      return null;
    }
  } catch (error) {
    logger.Error(`Failed to get aspect ${aopName}:`, error);
    return null;
  }
  
  return aspect;
}

/**
 * high performance aop method proxy
 */
function createOptimizedAOPProxy(
  originalMethod: Function,
  beforeAspects: IAspect[],
  afterAspects: IAspect[],
  hasDefaultBefore: boolean,
  hasDefaultAfter: boolean,
  _className: string
): Function {
  
  // if no aop, return original method
  if (beforeAspects.length === 0 && afterAspects.length === 0 && !hasDefaultBefore && !hasDefaultAfter) {
    return originalMethod;
  }
  
  // create optimized proxy function
  return async function(this: any, ...props: any[]) {
    // before handle
    if (hasDefaultBefore) {
      await this.__before(...props);
    }
    
    // batch execute before aspects
    if (beforeAspects.length > 0) {
      const beforePromises = beforeAspects.map(aspect => aspect.run(...props));
      await Promise.all(beforePromises);
    }
    
    // execute original method
    const result = await originalMethod.apply(this, props);
    
    // after handle
    if (hasDefaultAfter) {
      await this.__after(...props);
    }
    
    // batch execute after aspects
    if (afterAspects.length > 0) {
      const afterPromises = afterAspects.map(aspect => aspect.run(...props));
      await Promise.all(afterPromises);
    }
    
    return result;
  };
}

/**
 * Inject AOP (Aspect-Oriented Programming) functionality into a target class.
 * 
 * @param target The target class constructor function
 * @param prototypeChain The prototype chain of the target class
 * @param container The IoC container instance
 * @param _options Optional object definition options
 * 
 * 🚀 Performance optimized version with:
 * - LRU cache for aspect instances
 * - LRU cache for method precompilation  
 * - Batch processing
 * - Runtime optimization
 */
export function injectAOP(target: Function, prototypeChain: unknown,
  container: IContainer, _options?: ObjectDefinitionOptions) {
  
  const startTime = Date.now();
  aopCacheStats.totalRequests++;
  
  // compile aop interceptor
  const compiled = compileAOPInterceptor(target, container);
  const { beforeAspects, afterAspects, hasDefaultBefore, hasDefaultAfter } = compiled;
  
  // get cached method list
  const selfMethods = getMethodNames(target, true);
  const methodsFilter = (ms: string[]) => ms.filter((m: string) => !['constructor', 'init', '__before', '__after'].includes(m));
  
  // batch process aop injection
  const methodsToProcess = methodsFilter(selfMethods);
  const classMetaDatas: any[] = container.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) ?? [];
  
  // process default aop method
  if (hasDefaultBefore || hasDefaultAfter) {
    injectDefaultAOPOptimized(target, prototypeChain, methodsToProcess, hasDefaultBefore, hasDefaultAfter);
  }
  
  // process decorator aop
  const methodSpecificAOP = new Map<string, { beforeAspects: IAspect[], afterAspects: IAspect[] }>();
  
  for (const { type, name, method } of classMetaDatas) {
    if (name && [AOPType.Before, AOPType.BeforeEach, AOPType.After, AOPType.AfterEach].includes(type)) {
      
      if ([AOPType.BeforeEach, AOPType.AfterEach].includes(type)) {
        // apply BeforeEach/AfterEach to all methods
        if (type === AOPType.BeforeEach && !hasDefaultBefore) {
          methodsToProcess.forEach(methodName => {
            applyAOPToMethod(target, prototypeChain, methodName, beforeAspects, afterAspects, hasDefaultBefore, hasDefaultAfter);
          });
        }
        if (type === AOPType.AfterEach && !hasDefaultAfter) {
          methodsToProcess.forEach(methodName => {
            applyAOPToMethod(target, prototypeChain, methodName, beforeAspects, afterAspects, hasDefaultBefore, hasDefaultAfter);
          });
        }
      } else {
        // apply Before/After to specific method
        if (method && methodsToProcess.includes(method)) {
          let methodAOP = methodSpecificAOP.get(method);
          if (!methodAOP) {
            methodAOP = { beforeAspects: [], afterAspects: [] };
            methodSpecificAOP.set(method, methodAOP);
          }
          
          const aspect = getCachedAspect(container, name);
          if (aspect) {
            if (type === AOPType.Before) {
              methodAOP.beforeAspects.push(aspect);
            } else {
              methodAOP.afterAspects.push(aspect);
            }
          }
        }
      }
    }
  }
  
  // apply method specific aop
  for (const [methodName, { beforeAspects: methodBefore, afterAspects: methodAfter }] of methodSpecificAOP) {
    applyAOPToMethod(target, prototypeChain, methodName, methodBefore, methodAfter, hasDefaultBefore, hasDefaultAfter);
  }
  
  const processingTime = Date.now() - startTime;
  logger.Debug(`AOP injection completed for ${target.name} in ${processingTime}ms: ${methodsToProcess.length} methods processed`);
}

/**
 * apply aop to specific method
 */
function applyAOPToMethod(
  target: Function,
  prototypeChain: any,
  methodName: string,
  beforeAspects: IAspect[],
  afterAspects: IAspect[],
  hasDefaultBefore: boolean,
  hasDefaultAfter: boolean
) {
  const originalMethod = Reflect.get(prototypeChain, methodName);
  if (!originalMethod || !helper.isFunction(originalMethod)) {
    logger.Warn(`Method ${methodName} does not exist on ${target.name}`);
    return;
  }
  
  const optimizedProxy = createOptimizedAOPProxy(
    originalMethod,
    beforeAspects,
    afterAspects,
    hasDefaultBefore,
    hasDefaultAfter,
    target.name
  );
  
  Reflect.defineProperty(prototypeChain, methodName, {
    enumerable: true,
    configurable: false,
    writable: true,
    value: optimizedProxy
  });
  
  logger.Debug(`Applied AOP to ${target.name}.${methodName}: ${beforeAspects.length} before, ${afterAspects.length} after aspects`);
}

/**
 * default aop injection optimized version
 */
function injectDefaultAOPOptimized(
  target: Function, 
  prototypeChain: any, 
  methods: string[],
  hasDefaultBefore: boolean,
  hasDefaultAfter: boolean
) {
  methods.forEach((methodName) => {
    const originalMethod = Reflect.get(prototypeChain, methodName);
    if (!originalMethod || !helper.isFunction(originalMethod)) {
      return;
    }
    
    const optimizedProxy = createOptimizedAOPProxy(
      originalMethod,
      [], // default aop not use aspect array
      [],
      hasDefaultBefore,
      hasDefaultAfter,
      target.name
    );
    
    Reflect.defineProperty(prototypeChain, methodName, {
      enumerable: true,
      configurable: false,
      writable: true,
      value: optimizedProxy
    });
  });
}

/**
 * clear aop cache
 */
export function clearAOPCache(): void {
  aspectInstanceCache.clear();
  methodNamesCache.clear();
  compiledInterceptors.clear();
  
  aopCacheStats = {
    aspectCacheHits: 0,
    aspectCacheMisses: 0,
    methodNamesCacheHits: 0,
    methodNamesCacheMisses: 0,
    interceptorCacheHits: 0,
    interceptorCacheMisses: 0,
    totalRequests: 0
  };
  
  logger.Debug("AOP LRU cache cleared");
}

/**
 * warmup aop cache
 */
export function warmupAOPCache(targets: Function[], container: IContainer): void {
  const startTime = Date.now();
  
  targets.forEach(target => {
    // compile aop interceptor
    compileAOPInterceptor(target, container);
    // cache method name
    getCachedMethodNames(target);
  });
  
  const warmupTime = Date.now() - startTime;
  const stats = getAOPCacheStats();
  
  logger.Debug(`AOP cache warmed up for ${targets.length} targets in ${warmupTime}ms`);
  logger.Debug(`AOP cache stats - Aspects: ${stats.cacheSize.aspects}, Methods: ${stats.cacheSize.methodNames}, Interceptors: ${stats.cacheSize.interceptors}`);
  logger.Debug(`AOP hit rates - Overall: ${(stats.hitRates.overall * 100).toFixed(2)}%`);
}

/**
 * optimize aop cache
 */
export function optimizeAOPCache(): void {
  const initialSizes = {
    aspects: aspectInstanceCache.size,
    methodNames: methodNamesCache.size,
    interceptors: compiledInterceptors.size
  };
  
  // lru cache will be optimized automatically, but we can manually clear stale items
  aspectInstanceCache.purgeStale();
  methodNamesCache.purgeStale();
  compiledInterceptors.purgeStale();
  
  const finalSizes = {
    aspects: aspectInstanceCache.size,
    methodNames: methodNamesCache.size,
    interceptors: compiledInterceptors.size
  };
  
  const cleaned = {
    aspects: initialSizes.aspects - finalSizes.aspects,
    methodNames: initialSizes.methodNames - finalSizes.methodNames,
    interceptors: initialSizes.interceptors - finalSizes.interceptors
  };
  
  const totalCleaned = cleaned.aspects + cleaned.methodNames + cleaned.interceptors;
  
  if (totalCleaned > 0) {
    logger.Debug(`AOP cache optimized: removed ${totalCleaned} stale entries (aspects: ${cleaned.aspects}, methods: ${cleaned.methodNames}, interceptors: ${cleaned.interceptors})`);
  }
  
  const stats = getAOPCacheStats();
  logger.Debug(`AOP cache stats - Overall hit rate: ${(stats.hitRates.overall * 100).toFixed(2)}%`);
}
