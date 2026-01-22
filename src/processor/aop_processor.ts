/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { DefaultLogger as logger } from "koatty_logger";
import { IOCContainer } from "../container/container";
import { IAspect, AspectContext, TAGGED_AOP, TAGGED_CLS } from "../container/icontainer";
import { MetadataCache, CacheType } from "../utils/cache";

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

/**
 * Implementation of AspectContext interface.
 * Provides a unified context for aspect execution with parameter management.
 * 
 * Enhanced version with proceed function support built-in.
 */
class AspectContextImpl implements AspectContext {
  private currentArgs: any[];
  private readonly originalArgs: readonly any[];
  private proceedFn?: () => Promise<any>;
  private readonly aspectType: 'Around/AroundEach' | 'Before/After/BeforeEach/AfterEach';

  constructor(
    private target: any,
    private methodName: string,
    args: any[],
    private options: any,
    private app: any,
    originalArgs?: readonly any[],
    proceedFn?: () => Promise<any>
  ) {
    // Store original arguments as readonly (passed from outside to ensure immutability)
    this.originalArgs = originalArgs || Object.freeze([...args]);
    // Store current arguments as mutable
    this.currentArgs = args;
    // Store proceed function (for Around/AroundEach aspects)
    this.proceedFn = proceedFn;
    // Determine aspect type based on whether proceed is provided
    this.aspectType = proceedFn ? 'Around/AroundEach' : 'Before/After/BeforeEach/AfterEach';
  }

  getTarget(): any {
    return this.target;
  }

  getMethodName(): string {
    return this.methodName;
  }

  getArgs(): any[] {
    return this.currentArgs;
  }

  setArgs(args: any[]): void {
    this.currentArgs = args;
  }

  getOriginalArgs(): readonly any[] {
    return this.originalArgs;
  }

  getOptions(): any {
    return this.options;
  }

  getApp(): any {
    return this.app;
  }

  /**
   * Execute the proceed function (for Around aspects).
   * This method provides a convenient way to execute the original method or next aspect in the chain.
   * 
   * **IMPORTANT**: This method can ONLY be called in Around aspects.
   * Calling it in Before or After aspects will throw an error.
   * 
   * @param errorHandler - Optional error handler function
   * @returns Promise resolving to the result of the proceed function
   * @throws Error if proceed function is not available (Before/After aspects)
   * 
   * @example Basic usage in Around aspect
   * ```typescript
   * async run(joinPoint: AspectContext): Promise<any> {
   *   console.log('Before method execution');
   *   const result = await joinPoint.executeProceed();
   *   console.log('After method execution');
   *   return result;
   * }
   * ```
   * 
   * @example With error handling
   * ```typescript
   * async run(joinPoint: AspectContext): Promise<any> {
   *   try {
   *     return await joinPoint.executeProceed();
   *   } catch (error) {
   *     console.error('Method failed:', error);
   *     return fallbackValue;
   *   }
   * }
   * ```
   * 
   * @example Safe usage with hasProceed() check
   * ```typescript
   * async run(joinPoint: AspectContext): Promise<any> {
   *   if (joinPoint.hasProceed()) {
   *     // Safe to call in Around aspect
   *     return await joinPoint.executeProceed();
   *   } else {
   *     // This is a Before or After aspect
   *     console.log('Before/After aspect logic');
   *   }
   * }
   * ```
   */
  async executeProceed(errorHandler?: (error: any) => any): Promise<any> {
    if (!this.proceedFn) {
      const errorMessage = [
        `❌ executeProceed() can ONLY be called in Around/AroundEach aspects!`,
        ``,
        `Current aspect type: ${this.aspectType}`,
        `Target method: ${this.target?.constructor?.name || 'Unknown'}.${this.methodName}`,
        ``,
        `💡 Solution:`,
        `  - If you need to execute the method, use @Around or @AroundEach decorator`,
        `  - Do NOT use @Before, @After, @BeforeEach, or @AfterEach`,
        `  - Or check with joinPoint.hasProceed() before calling executeProceed()`,
        ``,
        `📚 Documentation: See docs/INTERFACE_SIMPLIFICATION.md for more details`
      ].join('\n');
      
      logger.Error(errorMessage);
      throw new Error(`executeProceed() is only available in Around/AroundEach aspects. Current aspect type: ${this.aspectType}.`);
    }

    try {
      return await this.proceedFn();
    } catch (error) {
      if (errorHandler) {
        return errorHandler(error);
      }
      throw error;
    }
  }

  /**
   * Check if proceed function is available (i.e., this is an Around aspect).
   * 
   * @returns true if proceed is available, false otherwise
   */
  hasProceed(): boolean {
    return !!this.proceedFn;
  }
}


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
 * Get the parameter count of the aspect's run method
 * @param aspect The aspect instance
 * @returns The number of parameters in the run method
 */
function getAspectRunParamCount(aspect: IAspect): number {
  if (!aspect || typeof aspect.run !== 'function') {
    return 0;
  }
  // Function.length returns the number of declared parameters
  return aspect.run.length;
}

/**
 * Get the parameter names of a function
 * @param fn The function to analyze
 * @returns Array of parameter names
 */
function getFunctionParamNames(fn: Function): string[] {
  const fnStr = fn.toString();
  // Match parameters in function declaration
  const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(/([^\s,]+)/g);
  return result || [];
}

/**
 * Prepare arguments for aspect run method based on its parameter definition
 * 
 * Rules:
 * 1. If run method has 0 params declared -> pass original args array (backward compatible)
 * 2. If run method has 1 param declared:
 *    - Check if param type is 'object' -> pack all method params into object with param names as keys
 *    - Otherwise -> pass only the first argument (auto-destructure single value)
 * 3. If run method has 2+ params declared -> destructure and pass multiple arguments
 * 
 * @param aspect The aspect instance
 * @param methodArgs The original method arguments
 * @param methodParamNames Optional parameter names from the decorated method (for object packing)
 * @returns Prepared arguments for aspect.run()
 * 
 * @internal Reserved for future use
 */
function _prepareAspectArgs(
  aspect: IAspect,
  methodArgs: any[],
  methodParamNames?: string[]
): { args: any[], useSpread: boolean } {
  const paramCount = getAspectRunParamCount(aspect);
  const aspectParamNames = getFunctionParamNames(aspect.run);
  
  // Backward compatible: if aspect.run declares standard signature (args, proceed?, options?)
  // or uses array type, keep passing args as array
  if (paramCount === 0 || paramCount >= 2) {
    // Check if first param looks like array/args parameter (common patterns)
    if (aspectParamNames.length > 0) {
      const firstParam = aspectParamNames[0].toLowerCase();
      if (firstParam === 'args' || firstParam.includes('args') || firstParam.includes('array')) {
        return { args: [methodArgs], useSpread: false };
      }
    }
    
    // For 2+ params without 'args' pattern, try to match method params to aspect params
    if (paramCount >= 2 && methodArgs.length > 0) {
      // Destructure: pass individual arguments
      return { args: methodArgs.slice(0, paramCount), useSpread: true };
    }
    
    // Default: pass args as array (backward compatible)
    return { args: [methodArgs], useSpread: false };
  }
  
  // paramCount === 1: single parameter scenario
  const firstParamName = aspectParamNames[0]?.toLowerCase() || '';
  
  // Check if it's the standard array pattern
  if (firstParamName === 'args' || firstParamName.includes('args') || firstParamName.includes('array')) {
    return { args: [methodArgs], useSpread: false };
  }
  
  // Check if first param is typed as object by looking at the parameter pattern
  // This is a heuristic - we check if the aspect expects an object by its parameter name
  // Common object parameter patterns: obj, data, params, options, payload, etc.
  const objectPatterns = ['obj', 'object', 'data', 'params', 'payload', 'request', 'req', 'body'];
  const isObjectParam = objectPatterns.some(pattern => 
    firstParamName === pattern || firstParamName.includes(pattern)
  );
  
  if (isObjectParam && methodParamNames && methodParamNames.length > 0) {
    // Pack all method parameters into an object using method parameter names as keys
    const packedObj: Record<string, any> = {};
    methodParamNames.forEach((name, index) => {
      if (index < methodArgs.length) {
        packedObj[name] = methodArgs[index];
      }
    });
    return { args: [packedObj], useSpread: true };
  }
  
  // Single primitive parameter: pass only the first argument
  if (methodArgs.length > 0) {
    return { args: [methodArgs[0]], useSpread: true };
  }
  
  // No arguments to pass
  return { args: [undefined], useSpread: true };
}

/**
 * Get method parameter names using reflect-metadata or function parsing
 * @param target The target class
 * @param methodName The method name
 * @returns Array of parameter names
 * 
 * @internal Reserved for future use
 */
function _getMethodParamNames(target: any, methodName: string): string[] {
  try {
    // Try to get from reflect-metadata first
    const _paramTypes = Reflect.getMetadata('design:paramtypes', target.prototype || target, methodName);
    const paramNames = Reflect.getMetadata('design:paramnames', target.prototype || target, methodName);
    
    if (paramNames && Array.isArray(paramNames)) {
      return paramNames;
    }
    
    // Fallback: parse function to extract parameter names
    const method = (target.prototype || target)[methodName];
    if (typeof method === 'function') {
      return getFunctionParamNames(method);
    }
  } catch (error) {
    logger.Debug(`Failed to get parameter names for ${methodName}:`, error);
  }
  
  return [];
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
export function getAOPMethodMetadata(target: any, methodName: string): any[] {
  const cacheKey = `aop:${target.name}:${methodName}`;

  // Check cache first
  const cached = metadataCache.get(CacheType.CLASS_METADATA, cacheKey);
  if (cached) {
    return cached;
  }

  // Get class AOP data (now returns array due to attachClassMetadata)
  const classAOPData = IOCContainer.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) || [];

  // Get method-specific AOP data (now returns array due to attachClassMetadata)  
  const methodAOPData = IOCContainer.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target, methodName) || [];

  logger.Debug(`Processing AOP metadata for ${target.name}.${methodName}:`);
  logger.Debug(`  Class AOP data: ${JSON.stringify(classAOPData)}`);
  logger.Debug(`  Method AOP data: ${JSON.stringify(methodAOPData)}`);

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
      logger.Debug(`  Method-level ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      methodLevelDecorators.set(data.type, currentData);
      if (existingData) {
        logger.Debug(`    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        logger.Debug(`    -> Using ${data.name} (first occurrence)`);
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
      logger.Debug(`  Class-level ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      classLevelDecorators.set(data.type, currentData);
      if (existingData) {
        logger.Debug(`    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        logger.Debug(`    -> Using ${data.name} (first occurrence)`);
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
      logger.Debug(`  Method-level from class ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      methodLevelDecorators.set(data.type, currentData);
      if (existingData) {
        logger.Debug(`    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        logger.Debug(`    -> Using ${data.name} (first occurrence)`);
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

  logger.Debug(`  Final AOP metadata: ${JSON.stringify(aopMetadata)}`);

  // Cache the result
  metadataCache.set(CacheType.CLASS_METADATA, cacheKey, aopMetadata);

  return aopMetadata;
}

/**
 * Execute before aspects
 */
async function executeBefore(target: any, methodName: string, args: any[], aspectData: any[], app?: any, originalArgs?: readonly any[]): Promise<any[]> {
  for (const data of aspectData) {
    if (data.type === 'Before' || data.type === 'BeforeEach') {
      try {
        const aspect = await get(data.aopName);
        if (aspect && typeof aspect.run === 'function') {
          // pass the target method name through options to the aspect, let the aspect know which method is being intercepted
          const enhancedOptions = {
            ...data.options,
            targetMethod: data.method || methodName // target method name
          };
          
          // Create AspectContext and execute (no proceed for Before aspects)
          const context = new AspectContextImpl(target, methodName, args, enhancedOptions, app, originalArgs);
          await aspect.run(context);
          // Update args from context (may have been modified)
          args = context.getArgs();
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
async function executeAfter(target: any, methodName: string, result: any, aspectData: any[], processedArgs?: any[], app?: any, originalArgs?: readonly any[]): Promise<any> {
  for (const data of aspectData) {
    if (data.type === 'After' || data.type === 'AfterEach') {
      try {
        const aspect = await get(data.aopName);
        if (aspect && typeof aspect.run === 'function') {
          // pass the target method name through options to the aspect, let the aspect know which method is being intercepted
          const enhancedOptions = {
            ...data.options,
            targetMethod: data.method || methodName // target method name
          };
          
          // Create AspectContext and execute (no proceed for After aspects)
          const context = new AspectContextImpl(target, methodName, processedArgs || [], enhancedOptions, app, originalArgs);
          await aspect.run(context);
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
async function executeAround(target: any, methodName: string, args: any[], aspectData: any[], originalMethod: Function, app?: any, originalArgs?: readonly any[]): Promise<any> {
  const aroundAspects = aspectData.filter(data => data.type === 'Around' || data.type === 'AroundEach');

  if (aroundAspects.length === 0) {
    return await originalMethod.apply(target, args);
  }

  // if there are multiple Around aspects, only use the last one (last in array = later declared)
  // this follows the decorator override principle: later declared decorators override earlier ones
  const selectedAspect = aroundAspects[aroundAspects.length - 1];

  try {
    const aspect = await get(selectedAspect.aopName);
    if (aspect && typeof aspect.run === 'function') {
      // pass the target method name through options to the aspect, let the aspect know which method is being intercepted
      const enhancedOptions = {
        ...selectedAspect.options,
        targetMethod: selectedAspect.method || methodName // target method name
      };

      // Create proceed function that uses context's current args
      const proceed = async (): Promise<any> => {
        // This closure will have access to the context created below
        const currentArgs = context.getArgs();
        return await originalMethod.apply(target, currentArgs);
      };

      // Create AspectContext with proceed function (for Around aspects)
      const context = new AspectContextImpl(target, methodName, args, enhancedOptions, app, originalArgs, proceed);

      // Execute aspect (proceed is now available via joinPoint.executeProceed())
      return await aspect.run(context);
    }
  } catch (error) {
    logger.Error(`Around aspect execution failed for ${selectedAspect.aopName}:`, error);
  }

  // if the aspect execution fails, fall back to the original method
  return await originalMethod.apply(target, args);
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

    // Save original arguments BEFORE any modifications (for AspectContext)
    const originalArgs = Object.freeze([...args]);

    try {
      // Get app instance if available
      const app = (this as any).app;

      // Check for __before method - highest priority, mutually exclusive with @BeforeEach
      const hasDefaultBefore = typeof this.__before === 'function';
      const hasBeforeEach = aspectData.some(data => data.type === 'BeforeEach');

      // Check for __after method - highest priority, mutually exclusive with @AfterEach  
      const hasDefaultAfter = typeof this.__after === 'function';
      const hasAfterEach = aspectData.some(data => data.type === 'AfterEach');

      // Warn about mutual exclusion (rule 3)
      if (hasDefaultBefore && hasBeforeEach) {
        logger.Warn(`__before and @BeforeEach both detected on ${target.name}.${methodName}, __before takes priority and @BeforeEach will be ignored`);
      }

      if (hasDefaultAfter && hasAfterEach) {
        logger.Warn(`__after and @AfterEach both detected on ${target.name}.${methodName}, __after takes priority and @AfterEach will be ignored`);
      }

      // 1. Execute __before if exists (highest priority, always first)
      if (hasDefaultBefore) {
        await this.__before();
      }

      // 2. Execute @Before aspects
      let processedArgs = args;
      const beforeAspects = aspectData.filter(data => data.type === 'Before');
      if (beforeAspects.length > 0) {
        processedArgs = await executeBefore(this, methodName, args, beforeAspects, app, originalArgs);
      }

      // 3. Execute BeforeEach aspects only if __before doesn't exist (mutually exclusive)
      if (!hasDefaultBefore) {
        const beforeEachAspects = aspectData.filter(data => data.type === 'BeforeEach');
        if (beforeEachAspects.length > 0) {
          processedArgs = await executeBefore(this, methodName, processedArgs, beforeEachAspects, app, originalArgs);
        }
      }

      // 4. Execute Around aspects or original method
      let result = await executeAround(this, methodName, processedArgs, aspectData, originalMethod, app, originalArgs);

      // 5. Execute AfterEach aspects only if __after doesn't exist (mutually exclusive)
      if (!hasDefaultAfter) {
        const afterEachAspects = aspectData.filter(data => data.type === 'AfterEach');
        if (afterEachAspects.length > 0) {
          result = await executeAfter(this, methodName, result, afterEachAspects, processedArgs, app, originalArgs);
        }
      }

      // 6. Execute @After aspects
      const afterAspects = aspectData.filter(data => data.type === 'After');
      if (afterAspects.length > 0) {
        result = await executeAfter(this, methodName, result, afterAspects, processedArgs, app, originalArgs);
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

    // Check for built-in methods more thoroughly - check both prototype and instance
    const hasBuiltinBefore = typeof target.prototype.__before === 'function' ||
      Object.prototype.hasOwnProperty.call(target.prototype, '__before');
    const hasBuiltinAfter = typeof target.prototype.__after === 'function' ||
      Object.prototype.hasOwnProperty.call(target.prototype, '__after');

    const hasAspectsOrDefaults = aspectData.length > 0 || hasBuiltinBefore || hasBuiltinAfter;

    if (hasAspectsOrDefaults) {
      const descriptor = Object.getOwnPropertyDescriptor(target.prototype, methodName);
      if (descriptor && descriptor.value) {
        Object.defineProperty(target.prototype, methodName, defineAOPMethod(target, methodName, descriptor));
        aopMethodCount++;

        if (hasBuiltinBefore || hasBuiltinAfter) {
          logger.Debug(`Applied AOP to ${target.name}.${methodName} with built-in methods: __before=${hasBuiltinBefore}, __after=${hasBuiltinAfter}`);
        }
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
