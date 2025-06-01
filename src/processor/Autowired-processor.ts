/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-02-26 17:09:48
 * @LastEditTime: 2025-02-26 17:09:49
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { DefaultLogger as logger } from "koatty_logger";
import { LRUCache } from "lru-cache";
import {
  IContainer, ObjectDefinitionOptions,
  TAGGED_PROP
} from "../container/IContainer";
import { recursiveGetMetadata } from "../utils/MetadataOpertor";

// use lru cache to unify cache strategy
interface DependencyPreProcessData {
  dependencies: string[];
  metadata: any;
  circularPaths: string[] | null;
  timestamp: number;
}

// dependency pre-parse lru cache
const dependencyPreProcessCache = new LRUCache<string, DependencyPreProcessData>({
  max: 1000, // max cache 1000 components
  ttl: 5 * 60 * 1000, // 5 minutes ttl
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: false,
});

// cache stats
let cacheStats = {
  hits: 0,
  misses: 0,
  totalRequests: 0
};

/**
 * get cache stats
 */
export function getDependencyCacheStats(): {
  cacheSize: number;
  cacheStats: typeof cacheStats;
  hitRate: number;
} {
  const hitRate = cacheStats.totalRequests > 0 ? cacheStats.hits / cacheStats.totalRequests : 0;
  return {
    cacheSize: dependencyPreProcessCache.size,
    cacheStats,
    hitRate
  };
}

/**
 * batch pre-process dependency info
 * @param targets target class array
 * @param container IoC container instance
 */
export function batchPreProcessDependencies(targets: Function[], container: IContainer): Map<string, any> {
  const results = new Map<string, any>();
  const startTime = Date.now();
  
  logger.Debug(`Starting batch preprocessing for ${targets.length} targets`);
  
  targets.forEach(target => {
    const className = target.name;
    const cacheKey = `${className}_${target.toString().length}`;
    
    cacheStats.totalRequests++;
    
    // check lru cache
    const cached = dependencyPreProcessCache.get(cacheKey);
    if (cached) {
      cacheStats.hits++;
      results.set(className, cached);
      logger.Debug(`Cache hit for ${className}`);
      return;
    }
    
    cacheStats.misses++;
    logger.Debug(`Cache miss for ${className}, processing...`);
    
    // pre-process dependencies
    const metaData = recursiveGetMetadata(container, TAGGED_PROP, target);
    const circularDetector = container.getCircularDependencyDetector();
    const dependencies: string[] = [];
    
    // collect all dependencies
    for (const metaKey in metaData) {
      const { type, identifier } = metaData[metaKey] || {};
      if (type && identifier) {
        dependencies.push(identifier);
        circularDetector.addDependency(className, identifier);
      }
    }
    
    // pre-detect circular dependencies
    const circularPaths = dependencies.length > 0 
      ? circularDetector.detectCircularDependency(className)
      : null;
    
    const processedData: DependencyPreProcessData = {
      dependencies,
      metadata: metaData,
      circularPaths,
      timestamp: Date.now()
    };
    
    // store to lru cache
    dependencyPreProcessCache.set(cacheKey, processedData);
    results.set(className, processedData);
  });
  
  const processingTime = Date.now() - startTime;
  const stats = getDependencyCacheStats();
  
  logger.Info(`Batch preprocessing completed for ${targets.length} targets in ${processingTime}ms`);
  logger.Info(`Cache stats - Size: ${stats.cacheSize}, Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
  
  return results;
}

/**
 * Inject autowired dependencies into the target class.
 * 
 * @param target The target class constructor function
 * @param prototypeChain The prototype chain object of the target class
 * @param container The IoC container instance
 * @param options Object definition options for dependency injection
 * @param isLazy Whether to use lazy loading for dependencies
 * 
 * @throws {Error} When a required dependency is not found and lazy loading is disabled
 * @throws {CircularDepError} When circular dependency is detected
 * 
 * @description
 * 🚀 Performance optimized version with:
 * - Batch dependency preprocessing
 * - LRU cache optimization  
 * - Circular dependency pre-detection
 * - Lazy loading optimization
 */
export function injectAutowired(target: Function, prototypeChain: object, container: IContainer,
  options?: ObjectDefinitionOptions, isLazy = false) {
  
  const className = target.name;
  const cacheKey = `${className}_${target.toString().length}`;
  
  cacheStats.totalRequests++;
  
  // try to get data from lru cache
  let preprocessedData = dependencyPreProcessCache.get(cacheKey);
  
  if (!preprocessedData) {
    cacheStats.misses++;
    logger.Debug(`Cache miss for ${className}, processing dependencies...`);
    
    // no cache, re-process
    const metaData = recursiveGetMetadata(container, TAGGED_PROP, target);
    const circularDetector = container.getCircularDependencyDetector();
    const dependencies: string[] = [];
    
    // collect dependency info
    for (const metaKey in metaData) {
      const { type, identifier } = metaData[metaKey] || {};
      if (type && identifier) {
        dependencies.push(identifier);
        circularDetector.addDependency(className, identifier);
      }
    }
    
    // pre-detect circular dependencies
    const circularPaths = dependencies.length > 0 
      ? circularDetector.detectCircularDependency(className)
      : null;
    
    preprocessedData = {
      dependencies,
      metadata: metaData,
      circularPaths,
      timestamp: Date.now()
    };
    
    // store to lru cache
    dependencyPreProcessCache.set(cacheKey, preprocessedData);
  } else {
    cacheStats.hits++;
    logger.Debug(`Cache hit for ${className}`);
  }
  
  const { metadata: metaData, dependencies: currentDependencies, circularPaths } = preprocessedData;
  const circularDetector = container.getCircularDependencyDetector();
  
  // register component and its dependencies
  circularDetector.registerComponent(className, className, currentDependencies);
  
  // batch dependency resolution
  const dependencyInstances = new Map<string, any>();
  const lazyDependencies = new Set<string>();
  
  // pre-resolve all dependencies
  for (const metaKey in metaData) {
    const { type, identifier, delay } = metaData[metaKey] || {};
    
    if (type && identifier) {
      // check if need to delay loading
      const shouldDelay = isLazy || delay || (circularPaths && circularPaths.includes(identifier));
      
      if (shouldDelay) {
        lazyDependencies.add(identifier);
      } else {
        try {
          // batch get dependency instance
          const dep = container.get(identifier, type);
          if (dep) {
            dependencyInstances.set(identifier, dep);
          }
        } catch (error) {
          logger.Debug(`Failed to pre-resolve dependency ${identifier}: ${error.message}`);
          lazyDependencies.add(identifier);
        }
      }
    }
  }
  
  // batch inject non-delay dependencies
  for (const metaKey in metaData) {
    const { type, identifier, args = [] } = metaData[metaKey] || {};
    
    if (type && identifier) {
      // check if need to delay loading
      if (lazyDependencies.has(identifier)) {
        // process delay loading
        setupLazyInjection(target, prototypeChain, metaKey, identifier, type, args, container, className, options);
        continue;
      }
      
      // get dependency from pre-resolved instance
      const dep = dependencyInstances.get(identifier);
      if (dep) {
        logger.Debug(`Register inject ${target.name} properties key: ${metaKey} => value: ${JSON.stringify(metaData[metaKey])}`);
        
        Reflect.defineProperty(prototypeChain, metaKey, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: dep
        });
      } else {
        logger.Warn(`Dependency ${identifier} not found for ${className}.${metaKey}, switching to lazy loading`);
        setupLazyInjection(target, prototypeChain, metaKey, identifier, type, args, container, className, options);
      }
    }
  }
  
  logger.Debug(`Dependency injection completed: ${className}, total dependencies: ${currentDependencies.length}, lazy: ${lazyDependencies.size}`);
}

/**
 * delay injection setup
 */
function setupLazyInjection(
  target: Function, 
  prototypeChain: object, 
  metaKey: string,
  identifier: string,
  type: string,
  args: any[],
  container: IContainer,
  className: string,
  options?: ObjectDefinitionOptions
) {
  logger.Debug(`Setting up lazy injection for ${className}.${metaKey} -> ${identifier}`);
  
  if (options) {
    options.isAsync = true;
  }
  
  const app = container.getApp();
  if (app?.once) {
    app.once("appReady", () => {
      try {
        logger.Debug(`Lazy loading triggered for ${className}.${metaKey} -> ${identifier}`);
        
        const dep = container.get(identifier, type, ...args);
        if (!dep) {
          logger.Error(`Lazy loading failed: Component ${identifier} not found for ${className}.${metaKey}`);
          return;
        }
        
        const instance = container.getInsByClass(target);
        if (!instance) {
          logger.Error(`Lazy loading failed: Instance of ${className} not found`);
          return;
        }
        
        Object.defineProperty(instance, metaKey, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: dep
        });
        
        logger.Debug(`Lazy injection successful: ${className}.${metaKey} = ${dep.constructor.name}`);
      } catch (error) {
        logger.Error(`Lazy injection failed: ${className}.${metaKey}:`, error);
      }
    });
  }
}

/**
 * clear dependency cache
 */
export function clearDependencyCache(): void {
  dependencyPreProcessCache.clear();
  cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0
  };
  logger.Debug("Dependency preprocessing LRU cache cleared");
}

/**
 * optimize dependency cache
 */
export function optimizeDependencyCache(): void {
  const initialSize = dependencyPreProcessCache.size;
  
  // lru cache will be optimized automatically, but we can manually clear stale items
  dependencyPreProcessCache.purgeStale();
  
  const finalSize = dependencyPreProcessCache.size;
  const cleaned = initialSize - finalSize;
  
  if (cleaned > 0) {
    logger.Info(`Dependency cache optimized: removed ${cleaned} stale entries`);
  }
  
  const stats = getDependencyCacheStats();
  logger.Info(`Dependency cache stats - Size: ${stats.cacheSize}, Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
}
