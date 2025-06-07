/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
// tslint:disable-next-line: no-import-side-effect
import * as helper from "koatty_lib";
import "reflect-metadata";
import { injectAOP } from "../processor/AOP-processor";
import {
  injectAutowired,
  batchPreprocessDependencies,
  clearDependencyCache,
  optimizeDependencyCache,
  getAutowiredCacheStats
} from "../processor/Autowired-processor";
import {
  warmupAOPCache,
  clearAOPCache,
  optimizeAOPCache,
  getAOPCacheStats
} from "../processor/AOP-processor";
import { injectValues } from "../processor/Values-processor";
import {
  getComponentTypeByClassName,
  overridePrototypeValue
} from "../utils/MetadataOpertor";
import {
  Application,
  Constructor, IContainer,
  ObjectDefinitionOptions, TAGGED_CLS, TAGGED_PROP, TAGGED_AOP
} from "./IContainer";

// import circular dependency detector
import { CircularDepDetector, CircularDepError } from "../utils/CircularDepDetector";
import { MetadataCache, CacheType } from "../utils/MetadataCache";
import { DefaultLogger as logger } from "koatty_logger";

/**
 * Container class implements IContainer interface for dependency injection.
 * Manages class instances, metadata, and dependency injection in an IOC container.
 * Uses singleton pattern to ensure only one container instance exists.
 * 
 * Thread Safety Considerations:
 * Although JavaScript is single-threaded, race conditions can occur in async scenarios.
 * This implementation uses async-safe singleton pattern with proper synchronization.
 * 
 * Features:
 * - Thread-safe singleton instance management
 * - Class and instance registration
 * - Metadata management with intelligent caching
 * - Dependency injection
 * - Component lifecycle management
 * - Property injection
 * - AOP support
 * - Circular dependency detection
 * - High-performance metadata caching for real-world scenarios
 * 
 * @class Container
 * @implements {IContainer}
 */
export class Container implements IContainer {
  private app: Application;
  private classMap: Map<string, Function>;
  private instanceMap: WeakMap<object | Function, any>;
  private metadataMap: WeakMap<object | Function, Map<string | symbol, any>>;
  private static instance: Container;

  // Thread safety for singleton pattern
  private static isInitializing: boolean = false;
  private static initializationPromise: Promise<Container> | null = null;

  // circular dependency detector
  private circularDependencyDetector: CircularDepDetector;

  // performance optimization components
  private metadataCache: MetadataCache;

  /**
   * Get singleton instance of Container with async-safe double-checked locking
   * Prevents race conditions in async scenarios where multiple calls might occur
   * simultaneously before the first instance is fully created.
   * 
   * @returns {Container | Promise<Container>} The singleton instance
   * @description
   * This method implements async-safe singleton pattern:
   * 1. First check if instance already exists (fast path)
   * 2. If not, check if initialization is in progress
   * 3. If already initializing, return the initialization promise
   * 4. Otherwise, start initialization with proper synchronization
   */
  static getInstance(): Container | Promise<Container> {
    // Fast path: instance already exists
    if (this.instance) {
      return this.instance;
    }

    // Check if initialization is already in progress
    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initializationPromise = this.createInstanceSafely();

    return this.initializationPromise;
  }

  /**
   * Safely create container instance with proper error handling
   * @private
   * @returns {Promise<Container>} Promise that resolves to the container instance
   */
  private static async createInstanceSafely(): Promise<Container> {
    try {
      // Double-check inside the critical section
      if (this.instance) {
        return this.instance;
      }

      // Create new instance
      const newInstance = new Container();

      // Atomic assignment
      this.instance = newInstance;

      logger.Debug("Container singleton instance created successfully");
      return newInstance;

    } catch (error) {
      logger.Error("Failed to create Container singleton instance:", error);
      throw error;
    } finally {
      // Reset synchronization state
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Get singleton instance synchronously (for backwards compatibility)
   * @returns {Container} The singleton instance
   * @throws {Error} If instance is not yet initialized
   */
  static getInstanceSync(): Container {
    if (!this.instance) {
      // Fallback to immediate initialization for sync access
      this.instance = new Container();
      logger.Debug("Container singleton instance created synchronously (fallback)");
    }
    return this.instance;
  }

  /**
   * Private constructor for Container class.
   * Initializes container properties including application object, class map,
   * instance map and metadata map.
   * @private
   */
  private constructor() {
    this.app = Object.create(null);
    this.classMap = new Map();
    this.instanceMap = new WeakMap();
    this.metadataMap = new WeakMap();
    this.circularDependencyDetector = new CircularDepDetector();

    // Initialize metadata cache for real-world performance optimization
    this.metadataCache = new MetadataCache({
      capacity: 2000,
      defaultTTL: 10 * 60 * 1000, // 10 minutes
      maxMemoryUsage: 100 * 1024 * 1024 // 100MB
    });

    logger.Debug("Container initialized with metadata cache");
  }

  /**
   * Set application instance
   * @param app Application instance
   */
  public setApp(app: Application) {
    this.app = app;
  }

  /**
   * Get the application instance.
   * 
   * @returns {any} The application instance
   */
  public getApp() {
    return this.app;
  }

  /**
   * Get circular dependency detector
   * @returns {CircularDepDetector} The circular dependency detector instance
   */
  public getCircularDependencyDetector(): CircularDepDetector {
    return this.circularDependencyDetector;
  }

  /**
   * Get metadata cache instance
   * @returns {MetadataCache} The metadata cache instance
   */
  public getMetadataCache(): MetadataCache {
    return this.metadataCache;
  }

  /**
   * Preloads metadata for specified component types with performance optimization options.
   * 
   * @param types - Array of component types to preload (e.g. ["CONTROLLER", "SERVICE"]). 
   *                Defaults to ["CONTROLLER", "SERVICE", "COMPONENT"] if empty.
   * @param options - Configuration options for the preload process:
   *   - optimizePerformance: Whether to enable performance optimizations (default: true)
   *   - warmupCaches: Whether to warm up AOP caches (default: true)
   *   - batchPreProcessDependencies: Whether to batch process dependencies (default: true)
   *   - clearStaleCache: Whether to clear stale cache before preload (default: false)
   * 
   * The method executes in 6 phases:
   * 1. Cache optimization and cleanup (if enabled)
   * 2. Type processing sorted by component count
   * 3. Metadata preloading for each component
   * 4. Batch dependency preprocessing (if enabled)
   * 5. AOP cache warmup (if enabled)
   * 6. Post-optimization processing (if enabled)
   * 
   * Logs detailed performance statistics including processing time, cache hit rates,
   * and total components processed.
   */
  public preloadMetadata(types: string[] = [], options: {
    optimizePerformance?: boolean;
    warmupCaches?: boolean;
    batchPreProcessDependencies?: boolean;
    clearStaleCache?: boolean;
  } = {}): void {
    const {
      optimizePerformance = true, // default enable optimization
      warmupCaches = true, // default enable cache warmup
      batchPreProcessDependencies = true, // default enable batch pre-process
      clearStaleCache = false // avoid unexpected cleanup
    } = options;

    const startTime = Date.now();

    // determine the types to process
    const targetTypes = types.length > 0 ? types : ["CONTROLLER", "SERVICE", "COMPONENT"];

    logger.Info(`Starting ${optimizePerformance ? 'optimized' : 'standard'} metadata preload for types: [${targetTypes.join(', ')}]...`);

    // phase 1: optional cache cleanup and optimization
    if (optimizePerformance) {
      if (clearStaleCache) {
        this.clearPerformanceCache();
        logger.Debug("Performance caches cleared before preload");
      }

      // optimize metadata lru cache
      this.metadataCache.optimize();
    }

    // phase 2: sort types by access frequency and process
    const sortedTypes = targetTypes.sort((a, b) => {
      const aCount = this.listClass(a).length;
      const bCount = this.listClass(b).length;
      return bCount - aCount; // descending, process types with more components first
    });

    let totalProcessed = 0;
    const allTargets: Function[] = [];

    for (const type of sortedTypes) {
      const typeStartTime = Date.now();

      // get all components of this type
      const componentsToPreload = this.listClass(type);

      if (componentsToPreload.length === 0) {
        logger.Debug(`No components found for type: ${type}`);
        continue;
      }

      // collect all target classes
      const typeTargets = componentsToPreload.map(c => c.target);
      allTargets.push(...typeTargets);

      // phase 3: metadata pre-load
      const preloadKeys: string[] = [];

      componentsToPreload.forEach(({ target, id }) => {
        const [, identifier] = id.split(':');

        // common metadata keys
        preloadKeys.push(
          `reflect:design:paramtypes:${identifier}`,
          `property:${TAGGED_PROP}:${identifier}`,
          `class:${TAGGED_CLS}:${TAGGED_AOP}:${identifier}`,
          `reflect:autowired:${identifier}`,
          `reflect:values:${identifier}`
        );

        // property specific metadata
        const propertyNames = Object.getOwnPropertyNames(target.prototype);
        propertyNames.forEach(propName => {
          if (propName !== 'constructor') {
            preloadKeys.push(
              `reflect:${propName}:autowired:${identifier}`,
              `reflect:${propName}:values:${identifier}`
            );
          }
        });
      });

      this.metadataCache.registerForPreload(preloadKeys);

      // pre-load metadata
      let preloadedCount = 0;
      this.metadataCache.preload(CacheType.REFLECT_METADATA, (key: string) => {
        try {
          const parts = key.split(':');
          const [cacheType, metadataKey, targetName, propertyKey] = parts;

          const target = this.findTargetByName(targetName);
          if (!target) return undefined;

          if (cacheType === 'reflect') {
            const value = propertyKey && propertyKey !== targetName
              ? Reflect.getMetadata(metadataKey, target, propertyKey)
              : Reflect.getMetadata(metadataKey, target);

            if (value !== undefined) {
              preloadedCount++;
            }
            return value;
          }

          return undefined;
        } catch (error) {
          logger.Debug(`Failed to preload metadata for key ${key}:`, error);
          return undefined;
        }
      });

      const typeTime = Date.now() - typeStartTime;
      totalProcessed += componentsToPreload.length;

      logger.Debug(`Processed ${type}: ${componentsToPreload.length} components, ${preloadedCount} metadata entries in ${typeTime}ms`);
    }

    // phase 4: batch dependency pre-process (if enabled)
    if (batchPreProcessDependencies && optimizePerformance && allTargets.length > 0) {
      try {
        batchPreprocessDependencies(allTargets, this);
        logger.Debug(`Batch dependency preprocessing completed for ${allTargets.length} targets`);
      } catch (error) {
        logger.Debug("Batch dependency preprocessing failed:", error);
      }
    }

    // phase 5: aop cache warmup (if enabled)
    if (warmupCaches && optimizePerformance && allTargets.length > 0) {
      try {
        warmupAOPCache(allTargets);
        logger.Debug(`AOP cache warmup completed for ${allTargets.length} targets`);
      } catch (error) {
        logger.Debug("AOP cache warmup failed:", error);
      }
    }

    // phase 6: post-optimization processing (if enabled)
    if (optimizePerformance) {
      try {
        optimizeDependencyCache();
      } catch (error) {
        logger.Debug("Dependency cache optimization failed:", error);
      }

      try {
        optimizeAOPCache();
      } catch (error) {
        logger.Debug("AOP cache optimization failed:", error);
      }
    }

    const totalTime = Date.now() - startTime;
    const cacheStats = this.metadataCache.getStats();

    // output statistics information
    if (optimizePerformance) {
      const detailedStats = this.getDetailedPerformanceStats();

      logger.Info(`Optimized metadata preload completed in ${totalTime}ms:`);
      logger.Info(`  - Types processed: [${sortedTypes.join(', ')}]`);
      logger.Info(`  - Total components: ${totalProcessed}`);
      logger.Info(`  - Metadata cache hit rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);

      if (detailedStats.lruCaches.dependencies) {
        logger.Info(`  - Dependencies cache hit rate: ${(detailedStats.lruCaches.dependencies.hitRate * 100).toFixed(2)}%`);
      }

      if (detailedStats.lruCaches.aop) {
        logger.Info(`  - AOP cache hit rate: ${(detailedStats.lruCaches.aop.hitRates.overall * 100).toFixed(2)}%`);
      }

      logger.Info(`  - Total cache size: ${this.calculateTotalCacheSize(detailedStats.lruCaches)}`);
    } else {
      logger.Info(`Standard metadata preload completed in ${totalTime}ms:`);
      logger.Info(`  - Types processed: [${sortedTypes.join(', ')}]`);
      logger.Info(`  - Total components: ${totalProcessed}`);
      logger.Info(`  - Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
    }
  }

  /**
   * Find target class by name
   */
  private findTargetByName(name: string): Function | undefined {
    for (const [, target] of this.classMap) {
      if (target.name === name) {
        return target;
      }
    }
    return undefined;
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    cache: any;
    totalRegistered: number;
    memoryUsage: {
      classMap: number;
      instanceMap: number;
      metadataMap: number;
    };
  } {
    const cacheStats = this.metadataCache.getStats();

    return {
      cache: cacheStats,
      totalRegistered: this.classMap.size,
      memoryUsage: {
        classMap: this.classMap.size,
        instanceMap: this.getInstanceMapSize(),
        metadataMap: this.getMetadataMapSize()
      }
    };
  }

  /**
   * Estimate instance map size
   */
  private getInstanceMapSize(): number {
    // WeakMap size cannot be directly determined, estimate based on class map
    return this.classMap.size;
  }

  /**
   * Estimate metadata map size
   */
  private getMetadataMapSize(): number {
    // WeakMap size cannot be directly determined, estimate based on class map
    return this.classMap.size * 3; // Rough estimate
  }

  /**
   * Register a class or instance to the container.
   * 
   * @param identifier - The identifier string or class/instance to register
   * @param target - Optional target class/instance or options
   * @param options - Optional configuration for the registration
   * @throws {Error} When target is not a class
   * @throws {CircularDepError} When circular dependency is detected
   * 
   * @example
   * ```ts
   * container.reg('UserService', UserService);
   * container.reg(UserService);
   * container.reg(UserService, { scope: 'Singleton' });
   * ```
   */
  public reg<T extends object | Function>(identifier: string | T, target?: T | ObjectDefinitionOptions,
    options?: ObjectDefinitionOptions): void {
    if (helper.isString(identifier)) {
      identifier = identifier;
      if (target !== undefined) {
        target = target as T;
      }
    } else {
      if (target && helper.isObject(target)) {
        options = target as ObjectDefinitionOptions;
      }
      target = identifier as T;
      identifier = this.getIdentifier(target);
    }

    if (!helper.isClass(target)) {
      throw new Error("target is not a class");
    }

    // Check if this specific identifier is already registered, not the target class
    const hasExistingInstance = this.instanceMap.get(target);

    options = {
      isAsync: false,
      initMethod: "constructor",
      destroyMethod: "destructor",
      scope: "Singleton",
      type: "COMPONENT",
      args: [],
      ...{ ...{ type: getComponentTypeByClassName(identifier) }, ...options }
    };

    // Always try to save class to metadata with the new identifier
    if (!this.getClass(<string>identifier, options.type)) {
      this.saveClass(options.type, <Function>target, <string>identifier);
    }

    // Only do the heavy initialization if instance doesn't exist
    if (!hasExistingInstance) {
      const dependencies = this.extractDependencies(target);

      try {
        // register component to circular dependency detector
        this.circularDependencyDetector.registerComponent(
          identifier,
          (target as Function).name,
          dependencies
        );

        // define app
        Reflect.defineProperty((<Function>target).prototype, "app", {
          configurable: false,
          enumerable: true,
          writable: true,
          value: this.app
        });

        // inject
        this._injection(target, options, identifier);
        // inject options once
        Reflect.defineProperty((<Function>target).prototype, "_options", {
          enumerable: false,
          configurable: false,
          writable: true,
          value: options
        });

        // async instance
        if (options.isAsync) {
          if (this.app && typeof this.app.on === 'function') {
            this.app.on("appReady", () => this._setInstance(target, options));
          } else {
            logger.Warn(`Cannot register async instance for ${identifier}: app.on is not available`);
          }
        }

        this._setInstance(target, options);

        // mark component resolution completed
        this.circularDependencyDetector.finishResolving(identifier);

      } catch (error) {
        if (error instanceof CircularDepError) {
          // log circular dependency error details
          logger.Error("Circular dependency detection failed:", error.toJSON());
          logger.Error("Detailed information:", error.getDetailedMessage());

          // provide resolution suggestions
          const suggestions = this.circularDependencyDetector.getResolutionSuggestions(error.circularPath);
          logger.Info("Resolution suggestions:");
          suggestions.forEach(suggestion => logger.Info(suggestion));

          throw error;
        }
        throw error;
      }
    } else {
      // Instance already exists, just register the new identifier mapping
      // No need to re-inject or re-initialize, just ensure the class mapping exists
      logger.Debug(`Registering additional identifier '${identifier}' for existing class ${(target as Function).name}`);
    }
  }

  /**
   * Extract the dependencies of a class with caching
   * @param target The target class
   * @returns {string[]} An array of dependencies
   */
  private extractDependencies(target: any): string[] {
    // Check cache first
    const cachedDependencies = this.metadataCache.getCachedDependencies(target);
    if (cachedDependencies) {
      return cachedDependencies;
    }

    const dependencies: string[] = [];

    try {
      // get constructor parameter types with caching
      let paramTypes = this.metadataCache.getReflectMetadata('design:paramtypes', target);
      if (!paramTypes) {
        paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
        this.metadataCache.setReflectMetadata('design:paramtypes', target, paramTypes);
      }

      paramTypes.forEach((type: any) => {
        if (type && type.name) {
          dependencies.push(type.name);
        }
      });

      // Get @Autowired decorated properties using IOC's listPropertyData method
      const autowiredProperties = this.listPropertyData(TAGGED_PROP, target);
      if (autowiredProperties && typeof autowiredProperties === 'object') {
        for (const [propertyKey, metadata] of Object.entries(autowiredProperties)) {
          if (metadata && typeof metadata === 'object') {
            const propertyMetadata = metadata as any;
            // Get the dependency identifier from @Autowired metadata
            const dependencyId = propertyMetadata.identifier || propertyMetadata.name || propertyKey;
            if (dependencyId && !dependencies.includes(dependencyId)) {
              dependencies.push(dependencyId);
            }
          }
        }
      }

      // Also try direct Reflect.getMetadata for backward compatibility
      const taggedPropMetadata = Reflect.getMetadata(TAGGED_PROP, target);
      if (taggedPropMetadata) {
        for (const key in taggedPropMetadata) {
          const propertyMetadata = taggedPropMetadata[key];
          if (propertyMetadata) {
            const dependencyId = propertyMetadata.identifier || propertyMetadata.name || key;
            if (dependencyId && !dependencies.includes(dependencyId)) {
              dependencies.push(dependencyId);
            }
          }
        }
      }

    } catch (error) {
      logger.Debug(`Failed to extract dependencies of ${target.name}:`, error);
    }

    // Cache the extracted dependencies
    this.metadataCache.setCachedDependencies(target, dependencies);

    logger.Debug(`Register component dependencies: ${target.name} -> [${dependencies.join(', ')}]`);

    return dependencies;
  }

  /**
   * Set instance to container.
   * @private
   * @param target The target class or function to be instantiated
   * @param options Instance definition options
   * @description Create an instance of the target class with given options and store it in the container.
   * If scope is Singleton, the instance will be sealed to prevent modifications.
   */
  private _setInstance<T extends object | Function>(target: T, options: ObjectDefinitionOptions): void {
    // Ensure options and args are properly defined
    const constructorArgs = options?.args || [];
    const instance = Reflect.construct(<Function>target, constructorArgs);
    overridePrototypeValue(instance);
    if (options?.scope === "Singleton") {
      Object.seal(instance);
    }

    // registration
    this.instanceMap.set(target, instance);
  }

  /**
   * Perform dependency injection on the target class.
   * 
   * @param target The target class to inject dependencies into
   * @param options Configuration options for dependency injection
   * @param identifier Component identifier for circular dependency detection
   * @private
   */
  private _injection<T extends object | Function>(target: T, options: ObjectDefinitionOptions, identifier: string): void {
    try {
      // start resolving dependencies
      this.circularDependencyDetector.startResolving(identifier);

      // inject autowired
      injectAutowired(<Function>target, (<Function>target).prototype, IOC, options);
      // inject properties values
      injectValues(<Function>target, (<Function>target).prototype, IOC, options);
      // inject AOP
      injectAOP(<Function>target);

    } catch (error) {
      // if it is a circular dependency error, throw it again
      if (error instanceof CircularDepError) {
        throw error;
      }

      // other injection errors
      logger.Error(`Injection failed for ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Get component instance by identifier.
   * 
   * @param identifier - Class constructor or class name string
   * @param type - Component type (COMPONENT/CONTROLLER/MIDDLEWARE/SERVICE)
   * @param args - Constructor arguments
   * @returns Component instance or null if not found
   * @throws {CircularDepError} When circular dependency is detected during resolution
   * 
   * @description
   * Returns singleton instance from cache by default.
   * Creates new instance when:
   * 1. Constructor arguments are provided
   * 2. Component scope is Prototype
   * For circular dependencies, delayed loading is expected and instances may be undefined initially.
   * @example
   * ```ts
   * const userService = container.get('UserService');
   * const userService = container.get(UserService);
   * const userService = container.get(UserService, 'Singleton');
   * const userService = container.get(UserService, 'Prototype', [1, 2, 3]);
   * ```
   */
  public get<T>(identifier: string | Constructor<T>, type?: string,
    ...args: any[]): T {
    let className: string;
    if (helper.isClass(<any>identifier)) {
      className = (<Constructor<T>>identifier)?.name;
    } else {
      className = <string>identifier;
    }

    if (!type) {
      type = getComponentTypeByClassName(className);
    }

    const target = <T>this.getClass(className, type);
    if (!target) {
      throw new Error(`Bean ${className} not found`);
    }

    const options = Reflect.get((<Function>target).prototype, "_options");
    const isPrototype = options?.scope === "Prototype";

    // Create new instance when:
    // 1. Explicit args provided
    // 2. OR scope is Prototype (ignore instanceMap)
    if (args.length > 0 || isPrototype) {
      try {
        // for Prototype scope, detect circular dependency each time
        if (isPrototype) {
          const cycle = this.circularDependencyDetector.detectCircularDependency(className);
          if (cycle) {
            const circularError = new CircularDepError(
              `Prototype scope component has circular dependency: ${className}`,
              [className],
              cycle
            );
            logger.Error("Circular dependency detection failed:", circularError.toJSON());
            throw circularError;
          }
        }

        const instance = Reflect.construct(<Function>target, args, <Function>target);
        overridePrototypeValue(<Function>instance);
        return instance as T;
      } catch (error) {
        if (error instanceof CircularDepError) {
          throw error;
        }
        // Safely handle error message extraction
        const errorMessage = error && typeof error === 'object' && 'message' in error 
          ? (error as Error).message 
          : String(error || 'Unknown error');
        throw new Error(`Failed to create instance of ${className}: ${errorMessage}`);
      }
    }

    // Return cached instance for Singleton
    let instance = this.instanceMap.get(<Function>target) as T;
    if (!instance) {
      // Check if this component is part of a circular dependency
      const detector = this.circularDependencyDetector;
      const hasCircularDeps = detector.hasCircularDependencies();

      if (hasCircularDeps) {
        const allCircularDeps = detector.getAllCircularDependencies();
        const isPartOfCircularDependency = allCircularDeps.some(cycle =>
          cycle.includes(className)
        );

        if (isPartOfCircularDependency) {
          // For circular dependencies, return undefined - delayed loading is expected
          logger.Debug(`Component ${className} is part of circular dependency, returning undefined (delayed loading expected)`);
          return undefined as T;
        }
      }

      // Check if this is a case where instances were cleared but class registration exists
      // AND we are not in a circular dependency scenario
      const wasInstanceCleared = this.classMap.has(`${type}:${className}`);

      if (wasInstanceCleared && !hasCircularDeps) {
        // Instance was cleared for non-circular dependency, safe to recreate
        logger.Debug(`Instance was cleared for ${className}, recreating with proper dependency injection flow`);

        try {
          // Re-run the full registration process to ensure proper dependency injection
          // Ensure options is defined with default values
          const safeOptions = options || { scope: "Singleton", args: [] };
          this._setInstance(<Function>target, safeOptions);
          this._injection(<Function>target, safeOptions, className);

          // Get the newly created instance
          instance = this.instanceMap.get(<Function>target) as T;
          if (!instance) {
            throw new Error(`Failed to recreate instance for ${className}`);
          }

          logger.Debug(`Successfully recreated singleton instance for ${className}`);
        } catch (error) {
          if (error instanceof CircularDepError) {
            // If circular dependency is detected during recreation, return undefined
            logger.Debug(`Circular dependency detected for ${className} during recreation, returning undefined (delayed loading)`);
            return undefined as T;
          } else {
            // Safely handle error message extraction
            const errorMessage = error && typeof error === 'object' && 'message' in error 
              ? (error as Error).message 
              : String(error || 'Unknown error');
            throw new Error(`Failed to recreate instance of ${className}: ${errorMessage}`);
          }
        }
      } else {
        // Either bean not found or in circular dependency mode - don't try to recreate
        if (hasCircularDeps) {
          logger.Debug(`${className} not found and circular dependencies exist, returning undefined for delayed loading`);
          return undefined as T;
        } else {
          throw new Error(`Bean ${className} not found`);
        }
      }
    }
    return instance;
  }

  /**
   * Get class by identifier and type from container.
   * 
   * @param {string} identifier The unique identifier of the class
   * @param {ComponentType} [type="COMPONENT"] The component type
   * @returns {Function} The class constructor
   * @example
   * ```ts
   * const userServiceClass = container.getClass('UserService');
   * const userServiceClass = container.getClass(UserService, 'Service');
   * ```
   */
  public getClass(identifier: string, type: string = "COMPONENT"): Function {
    return this.classMap.get(`${type}:${identifier}`);
  }

  /**
   * Get instance by class constructor
   * @param target The class constructor
   * @param args Constructor parameters
   * @returns Instance of the class or null if target is not a class
   * @template T Type of the class instance or function
   * @description Get instance of the class
   * @example
   * ```ts
   * const userService = container.getInsByClass(UserService);
   * const userService = container.getInsByClass(UserService, [1, 2, 3]);
   * ```
   */
  public getInsByClass<T extends object | Function>(target: T, args: any[] = []): T {
    if (!helper.isClass(target)) {
      return null;
    }
    // get instance from the Container
    const instance: any = this.instanceMap.get(target);
    // require Prototype instance
    if (args.length > 0) {
      // instantiation
      return Reflect.construct(<Function><unknown>target, args);
    } else {
      return instance;
    }
  }

  /**
   * Get metadata map for the specified target and key.
   * 
   * @param metadataKey The key of metadata
   * @param target The target class or object
   * @param propertyKey Optional property key
   * @returns Map instance containing metadata
   * @example
   * ```ts
   * const metadataMap = container.getMetadataMap('key', UserService);
   * const metadataMap = container.getMetadataMap('key', UserService, 'method');
   * ```
   */
  public getMetadataMap(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol) {
    // filter Object.create(null)
    if (typeof target === "object" && target.constructor) {
      target = target.constructor;
    }
    if (!this.metadataMap.has(target)) {
      this.metadataMap.set(target, new Map());
    }
    const key = propertyKey ? `${helper.toString(metadataKey)}:${helper.toString(propertyKey)}` : metadataKey;
    const map = this.metadataMap.get(target);
    if (!map.has(key)) {
      map.set(key, new Map());
    }
    return map.get(key);
  }

  /**
   * Get the identifier for a target class or object.
   * 
   * @param target The target class constructor function or object instance
   * @returns The identifier string. For functions, returns the tagged metadata id or function name.
   *          For objects, returns the constructor name.
   */
  public getIdentifier(target: Function | object): string {
    if (helper.isFunction(target)) {
      const metaData = Reflect.getOwnMetadata(TAGGED_CLS, target);
      return metaData ? metaData.id ?? "" : target.name ?? "";
    }
    return target.constructor ? target.constructor.name ?? "" : "";
  }

  /**
   * Get the component type of target class or object.
   * 
   * @param target The target class constructor or object instance
   * @returns The component type string
   */
  public getType(target: Function | object) {
    const metaData = Reflect.getOwnMetadata(TAGGED_CLS, target);
    if (metaData) {
      return metaData.type;
    }
    const identifier = (<Function>target).name || (target.constructor ? target.constructor.name : "");
    return getComponentTypeByClassName(identifier);
  }

  /**
   * Save class metadata and store class module in container.
   * 
   * @param type The component type
   * @param module The class module to be saved
   * @param identifier The unique identifier for the class
   */
  public saveClass(type: string, module: Function, identifier: string) {
    Reflect.defineMetadata(TAGGED_CLS, { id: identifier, type }, module);
    const key = `${type}:${identifier}`;
    if (!this.classMap.has(key)) {
      this.classMap.set(key, module);
    }
  }

  /**
   * List all registered classes of specified component type.
   * @param type The component type to filter
   * @returns Array of objects containing class id and target class
   */
  public listClass(type: string = "COMPONENT") {
    return Array.from(this.classMap.entries())
      .filter(([k]) => k.startsWith(type))
      .map(([k, v]) => ({ id: k, target: v }));
  }

  /**
   * Save class metadata to the container with caching.
   * @param type The type of metadata
   * @param decoratorNameKey The decorator name or symbol key
   * @param data The metadata to be saved
   * @param target The class constructor function or object instance
   * @param propertyName Optional property name if the metadata is for a class member
   * @example
   * ```ts
   * container.saveClassMetadata('key', 'name', 'value', UserService);
   * container.saveClassMetadata('key', 'name', 'value', UserService, 'method');
   * ```
   */
  public saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    originMap.set(decoratorNameKey, data);

    // Cache the metadata for faster access
    this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, data, propertyName);
  }

  /**
   * Get metadata value by type and decorator key with caching.
   * 
   * @param type The metadata type
   * @param decoratorNameKey The decorator name or symbol key
   * @param target The target class or object
   * @param propertyName Optional property name
   * @returns The metadata value associated with the decorator key
   * @example
   * ```ts
   * const value = container.getClassMetadata('key', 'name', UserService);
   * const value = container.getClassMetadata('key', 'name', UserService, 'method');
   * ```
   */
  public getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object,
    propertyName?: string) {
    // Try cache first
    const cachedValue = this.metadataCache.getClassMetadata(type, String(decoratorNameKey), target, propertyName);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    // Fallback to original method
    const originMap = this.getMetadataMap(type, target, propertyName);
    const value = originMap.get(decoratorNameKey);

    // Cache the result for next time
    if (value !== undefined) {
      this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, value, propertyName);
    }

    return value;
  }

  /**
   * Attach class metadata to the target.
   * @param type The type of metadata
   * @param decoratorNameKey The key of the decorator
   * @param data The metadata to attach
   * @param target The target class or object
   * @param propertyName Optional property name if attaching to a class property
   * @example
   * ```ts
   * container.attachClassMetadata('key', 'name', 'value', UserService);
   * container.attachClassMetadata('key', 'name', 'value', UserService, 'method');
   * ```
   */
  public attachClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    if (!originMap.has(decoratorNameKey)) {
      originMap.set(decoratorNameKey, []);
    }
    originMap.get(decoratorNameKey).push(data);

    // Update cache
    const currentValue = this.metadataCache.getClassMetadata(type, String(decoratorNameKey), target, propertyName) || [];
    currentValue.push(data);
    this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, currentValue, propertyName);
  }

  /**
   * Save property metadata to the container with caching.
   * 
   * @param decoratorNameKey The key of the decorator metadata
   * @param data The metadata to be saved
   * @param target The target class or object
   * @param propertyName The name of the property
   * @example
   * ```ts
   * container.savePropertyData('key', 'value', UserService, 'property');
   * ```
   */
  public savePropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    originMap.set(propertyName, data);

    // Cache the property metadata
    this.metadataCache.setPropertyMetadata(String(decoratorNameKey), target, propertyName, data);
  }

  /**
   * Attach property metadata to the target object/class.
   * 
   * @param decoratorNameKey The key to identify the decorator metadata
   * @param data The metadata to be attached
   * @param target The target object or class constructor
   * @param propertyName The name of the property to attach metadata to
   * @example
   * ```ts
   * container.attachPropertyData('key', 'value', UserService, 'property');
   * ```
   */
  public attachPropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    if (!originMap.has(propertyName)) {
      originMap.set(propertyName, []);
    }
    originMap.get(propertyName).push(data);

    // Update cache
    const currentValue = this.metadataCache.getPropertyMetadata(String(decoratorNameKey), target, propertyName) || [];
    currentValue.push(data);
    this.metadataCache.setPropertyMetadata(String(decoratorNameKey), target, propertyName, currentValue);
  }

  /**
   * Get property metadata by decorator name key with caching.
   * 
   * @param decoratorNameKey The decorator name key
   * @param target The target class or object
   * @param propertyName The property name
   * @returns The metadata value for the property
   * @example
   * ```ts
   * const value = container.getPropertyData('key', UserService, 'property');
   * ```
   */
  public getPropertyData(decoratorNameKey: string | symbol, target: Function | object,
    propertyName: string | symbol) {
    // Try cache first
    const cachedValue = this.metadataCache.getPropertyMetadata(String(decoratorNameKey), target, propertyName);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    // Fallback to original method
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    const value = originMap.get(propertyName);

    // Cache the result
    if (value !== undefined) {
      this.metadataCache.setPropertyMetadata(String(decoratorNameKey), target, propertyName, value);
    }

    return value;
  }

  /**
   * Get property data by decorator name key.
   * 
   * @param decoratorNameKey The decorator name key
   * @param target The target class or object
   * @returns {object} The property data object
   * @example
   * ```ts
   * const data = container.listPropertyData('key', UserService);
   * ```
   */
  public listPropertyData(decoratorNameKey: string | symbol, target: Function | object) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    const data: any = {};
    for (const [key, value] of originMap) {
      data[key] = value;
    }
    return data;
  }

  /**
   * Generate and log dependency analysis report
   */
  public generateDependencyReport(): void {
    const report = this.circularDependencyDetector.generateDependencyReport();

    logger.Info("=== Dependency analysis report ===");
    logger.Info(`Total components: ${report.totalComponents}`);
    logger.Info(`Resolved components: ${report.resolvedComponents}`);
    logger.Info(`Unresolved components: ${report.unresolvedComponents.length}`);

    if (report.circularDependencies.length > 0) {
      logger.Warn(`Found ${report.circularDependencies.length} circular dependencies:`);
      report.circularDependencies.forEach((cycle, index) => {
        logger.Warn(`  ${index + 1}. ${cycle.join(' -> ')}`);

        // provide resolution suggestions
        const suggestions = this.circularDependencyDetector.getResolutionSuggestions(cycle);
        suggestions.forEach(suggestion => logger.Info(`     ${suggestion}`));
      });
    } else {
      logger.Info("✓ No circular dependencies found");
    }

    if (report.unresolvedComponents.length > 0) {
      logger.Warn("Unresolved components:");
      report.unresolvedComponents.forEach(comp => logger.Warn(`  - ${comp}`));
    }

    // output dependency graph visualization
    logger.Debug(this.circularDependencyDetector.getDependencyGraphVisualization());
  }

  /**
   * Check for circular dependencies in the container
   * @returns {boolean} True if circular dependencies exist
   */
  public hasCircularDependencies(): boolean {
    return this.circularDependencyDetector.hasCircularDependencies();
  }

  /**
   * Get all circular dependencies
   * @returns {string[][]} Array of circular dependency paths
   */
  public getCircularDependencies(): string[][] {
    return this.circularDependencyDetector.getAllCircularDependencies();
  }

  /**
   * clear all resources in container
   * @memberof Container
   */
  public clear(): void {
    this.classMap.clear();
    this.instanceMap = new WeakMap();
    this.metadataMap = new WeakMap();
    this.circularDependencyDetector.clear();

    // Clear performance optimization components
    this.metadataCache.clear();

    logger.Debug("Container cleared including performance optimization components");
  }

  /**
   * Clear metadata while preserving class registrations and instances
   * This is useful for tests that need to reset state but keep decorator metadata
   * @memberof Container
   */
  public clearMetadata(): void {
    this.metadataMap = new WeakMap();
    this.metadataCache.clear();

    logger.Debug("Container metadata cleared");
  }

  /**
   * Clear class registrations while preserving instances and metadata
   * This is useful for tests that need to reset state but keep decorator metadata
   * @memberof Container
   */
  public clearClass(): void {
    this.classMap.clear();
    logger.Debug("Container class cleared");
  }

  /**
   * Clear only instances while preserving class registrations and metadata
   * This is useful for tests that need to reset state but keep decorator metadata
   * @memberof Container
   */

  public clearInstances(): void {
    this.instanceMap = new WeakMap();
    this.circularDependencyDetector.clear();

    logger.Debug("Container instances cleared, class registrations and metadata preserved");
  }

  /**
   * get detailed performance stats (enhanced version)
   */
  public getDetailedPerformanceStats(): {
    cache: any;
    containers: {
      totalRegistered: number;
      byType: Record<string, number>;
      memoryUsage: {
        classMap: number;
        instanceMap: number;
        metadataMap: number;
      };
    };
    hotspots: {
      mostAccessedTypes: string[];
      circularDependencies: number;
      lazyLoadingCount: number;
    };
    lruCaches: {
      metadata: any;
      dependencies?: any;
      aop?: any;
    };
  } {
    const cacheStats = this.metadataCache.getStats();

    // count the number of components of each type
    const typeStats: Record<string, number> = {};
    const typeOrder = ["CONTROLLER", "SERVICE", "COMPONENT", "REPOSITORY"];

    for (const type of typeOrder) {
      typeStats[type] = this.listClass(type).length;
    }

    // count the number of circular dependencies
    const circularCount = this.circularDependencyDetector.getAllCircularDependencies().length;
    const mostAccessedTypes = Object.entries(typeStats)
      .sort(([, a], [, b]) => b - a)
      .map(([type]) => type);

    // get lru cache stats
    const lruCaches: any = {
      metadata: cacheStats
    };

    // get dependency processor lru cache stats
    try {
      lruCaches.dependencies = getAutowiredCacheStats();
    } catch (error) {
      logger.Debug("Failed to get dependency cache stats:", error);
    }

    // get aop processor lru cache stats
    try {
      lruCaches.aop = getAOPCacheStats();
    } catch (error) {
      logger.Debug("Failed to get AOP cache stats:", error);
    }

    return {
      cache: cacheStats,
      containers: {
        totalRegistered: this.classMap.size,
        byType: typeStats,
        memoryUsage: {
          classMap: this.classMap.size,
          instanceMap: this.getInstanceMapSize(),
          metadataMap: this.getMetadataMapSize()
        }
      },
      hotspots: {
        mostAccessedTypes,
        circularDependencies: circularCount,
        lazyLoadingCount: 0 // TODO: implement lazy loading count
      },
      lruCaches
    };
  }

  /**
   * calculate total lru cache size
   */
  private calculateTotalCacheSize(lruCaches: any): string {
    let totalSize = 0;

    // metadata cache memory usage
    if (lruCaches.metadata && lruCaches.metadata.memoryUsage) {
      totalSize += lruCaches.metadata.memoryUsage;
    }

    // dependency cache size (estimated)
    if (lruCaches.dependencies && lruCaches.dependencies.cacheSize) {
      totalSize += lruCaches.dependencies.cacheSize * 1024; // estimated 1KB per dependency
    }

    // aop cache size (estimated)
    if (lruCaches.aop && lruCaches.aop.cacheSize) {
      const aopSize = lruCaches.aop.cacheSize;
      totalSize += (aopSize.aspects + aopSize.methodNames + aopSize.interceptors) * 2048; // estimated 2KB per aop item
    }

    return `${(totalSize / 1024).toFixed(1)}KB`;
  }

  /**
   * Batch register components
   * @param components - The components to register
   * @param batchOptions - The batch options
   * @example
   * ```ts
   * container.batchRegister([UserService, UserRepository], { preProcessDependencies: true, warmupAOP: true });
   * ```
   */
  public batchRegister(components: { target: Function, identifier?: string, options?: ObjectDefinitionOptions }[],
    batchOptions: { preProcessDependencies?: boolean, warmupAOP?: boolean } = {}): void {
    const startTime = Date.now();
    logger.Info(`Starting batch registration for ${components.length} components...`);

    try {
      // phase 1: if enabled pre-process, use unified preloadMetadata for optimization
      if (batchOptions.preProcessDependencies || batchOptions.warmupAOP) {
        // extract all component types
        const componentTypes = [...new Set(components.map(c => {
          const identifier = c.identifier || this.getIdentifier(c.target);
          return this.getType(c.target) || getComponentTypeByClassName(identifier);
        }))];

        this.preloadMetadata(componentTypes, {
          optimizePerformance: true,
          batchPreProcessDependencies: batchOptions.preProcessDependencies,
          warmupCaches: batchOptions.warmupAOP,
          clearStaleCache: false
        });

        logger.Debug(`Integrated optimization completed for types: [${componentTypes.join(', ')}]`);
      }

      // phase 2: sort components by dependency order
      const sortedComponents = this.topologicalSortComponents(components);

      // phase 3: batch registration
      let successCount = 0;
      for (const component of sortedComponents) {
        try {
          const { target, identifier, options } = component;
          const id = identifier || this.getIdentifier(target);
          this.reg(id, target, options);
          successCount++;
        } catch (error) {
          logger.Error(`Failed to register component ${component.identifier || component.target.name}:`, error);
        }
      }

      const totalTime = Date.now() - startTime;
      logger.Info(`Batch registration completed: ${successCount}/${components.length} components registered in ${totalTime}ms`);

    } catch (error) {
      logger.Error("Batch registration failed:", error);
      throw error;
    }
  }

  /**
   * topological sort components (by dependency order)
   */
  private topologicalSortComponents(components: { target: Function, identifier?: string, options?: ObjectDefinitionOptions }[]): typeof components {
    const dependencyGraph = new Map<string, string[]>();
    const componentMap = new Map<string, typeof components[0]>();

    // build dependency graph
    for (const component of components) {
      const identifier = component.identifier || this.getIdentifier(component.target);
      componentMap.set(identifier, component);

      const dependencies = this.extractDependencies(component.target);
      dependencyGraph.set(identifier, dependencies.filter(dep =>
        components.some(c => (c.identifier || this.getIdentifier(c.target)) === dep)
      ));
    }

    // topological sort
    const sorted: typeof components = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (identifier: string) => {
      if (visiting.has(identifier)) {
        logger.Warn(`Circular dependency detected involving ${identifier}, using registration order`);
        return;
      }
      if (visited.has(identifier)) return;

      visiting.add(identifier);
      const dependencies = dependencyGraph.get(identifier) || [];

      for (const dep of dependencies) {
        if (componentMap.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(identifier);
      visited.add(identifier);

      const component = componentMap.get(identifier);
      if (component) {
        sorted.push(component);
      }
    };

    for (const component of components) {
      const identifier = component.identifier || this.getIdentifier(component.target);
      visit(identifier);
    }

    return sorted;
  }

  /**
   * Clear performance cache
   */
  public clearPerformanceCache(): void {
    // clear metadata cache
    this.metadataCache.clear();

    // clear processor lru cache
    try {
      clearDependencyCache();
    } catch (error) {
      logger.Debug("Autowired cache cleanup failed:", error);
    }

    try {
      clearAOPCache();
    } catch (error) {
      logger.Debug("AOP cache cleanup failed:", error);
    }

    logger.Debug("Performance cache cleared");
  }
}

/**
 * Global IOC container instance with async-safe initialization.
 * Singleton pattern implementation to ensure only one container instance exists.
 * Handles async scenarios properly to prevent race conditions.
 * 
 * @constant
 * @type {Container}
 * @throws {Error} When multiple container versions conflict
 */
export const IOC: IContainer = (function () {
  // Global synchronization state
  let globalInitialization: Promise<IContainer> | null = null;
  let isGlobalInitializing = false;

  // Immediate execution function with async safety
  const initializeGlobalIOC = async (): Promise<IContainer> => {
    // Check if already exists
    if ((<any>global).__KOATTY_IOC__) {
      return (<any>global).__KOATTY_IOC__;
    }

    // Prevent concurrent initialization
    if (isGlobalInitializing && globalInitialization) {
      return globalInitialization;
    }

    isGlobalInitializing = true;

    try {
      // Double-check pattern
      if ((<any>global).__KOATTY_IOC__) {
        return (<any>global).__KOATTY_IOC__;
      }

      // Get or create container instance
      const containerResult = Container.getInstance();
      const instance = containerResult instanceof Promise ? await containerResult : containerResult;

      // Atomic assignment to global
      (<any>global).__KOATTY_IOC__ = instance;

      logger.Debug("Global IOC container initialized successfully");
      return instance;

    } catch (error) {
      logger.Error("Failed to initialize global IOC container:", error);
      throw new Error(`IOC container initialization failed: ${error.message}`);
    } finally {
      isGlobalInitializing = false;
      globalInitialization = null;
    }
  };

  // Check if we're in a Node.js environment (which we are)
  if (typeof global !== 'undefined') {
    // For immediate synchronous access, try sync initialization first
    try {
      if ((<any>global).__KOATTY_IOC__) {
        return (<any>global).__KOATTY_IOC__;
      }

      // Try synchronous initialization
      const instance = Container.getInstanceSync();
      (<any>global).__KOATTY_IOC__ = instance;
      return instance;

    } catch (error) {
      logger.Warn("Synchronous IOC initialization failed, falling back to async:", error);

      // Store the promise for later resolution
      globalInitialization = initializeGlobalIOC();

      // For module loading scenarios, return a proxy that will resolve later
      return new Proxy({} as IContainer, {
        get(target, prop) {
          if ((<any>global).__KOATTY_IOC__) {
            return (<any>global).__KOATTY_IOC__[prop];
          }
          throw new Error(`IOC container not ready. Please await container initialization or use IOC.ready().`);
        }
      });
    }
  }

  // Fallback for other environments
  const instance = Container.getInstanceSync();
  (<any>global).__KOATTY_IOC__ = instance;
  return instance;
})();

/**
 * Ensure IOC container is ready for use
 * @returns {Promise<IContainer>} Promise that resolves when container is ready
 */
export const ensureIOCReady = async (): Promise<IContainer> => {
  if ((<any>global).__KOATTY_IOC__ && typeof (<any>global).__KOATTY_IOC__.reg === 'function') {
    return (<any>global).__KOATTY_IOC__;
  }

  // Re-initialize if needed
  const containerResult = Container.getInstance();
  const instance = containerResult instanceof Promise ? await containerResult : containerResult;
  (<any>global).__KOATTY_IOC__ = instance;

  return instance;
};

/**
 * IOC container instance export.
 * Alias for IOC
 * @type {Container}
 */
export const IOCContainer = IOC;
