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
import { injectAutowired } from "../processor/Autowired-processor";
import { injectValues } from "../processor/Values-processor";
import {
  getComponentTypeByClassName,
  overridePrototypeValue
} from "../utils/MetadataOpertor";
import {
  Application,
  ComponentType, Constructor, IContainer,
  ObjectDefinitionOptions, TAGGED_CLS, TAGGED_PROP, TAGGED_AOP
} from "./IContainer";

// import circular dependency detector
import { CircularDependencyDetector, CircularDependencyError } from "../utils/CircularDependencyDetector";
import { MetadataCache } from "../utils/MetadataCache";
import { VersionConflictDetector, VersionConflictError } from "../utils/VersionConflictDetector";
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
  private circularDependencyDetector: CircularDependencyDetector;
  
  // performance optimization components
  private metadataCache: MetadataCache;

  // version conflict detector for handling multiple koatty_container versions
  private versionConflictDetector: VersionConflictDetector;

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
    this.circularDependencyDetector = new CircularDependencyDetector();
    
    // Initialize metadata cache for real-world performance optimization
    this.metadataCache = new MetadataCache({
      capacity: 2000,
      defaultTTL: 10 * 60 * 1000, // 10 minutes
      maxMemoryUsage: 100 * 1024 * 1024 // 100MB
    });

    // Initialize version conflict detector
    this.versionConflictDetector = new VersionConflictDetector();
    this.versionConflictDetector.registerVersion();
    
    // Check for version conflicts during initialization
    this.checkVersionConflicts();
    
    logger.Debug("Container initialized with metadata cache and version conflict detection");
  }

  /**
   * Check for version conflicts and handle them appropriately
   * @private
   */
  private checkVersionConflicts(): void {
    try {
      const conflict = this.versionConflictDetector.detectVersionConflicts();
      if (conflict) {
        logger.Warn("=== Version Conflict Detected ===");
        logger.Warn(conflict.getConflictDetails());
        
        const suggestions = conflict.getResolutionSuggestions();
        logger.Warn("Resolution suggestions:");
        suggestions.forEach(suggestion => logger.Warn(`  ${suggestion}`));
        
        // Try to resolve the conflict automatically
        const resolved = this.versionConflictDetector.resolveVersionConflict('use_latest');
        if (!resolved) {
          logger.Error("Failed to automatically resolve version conflict. Manual intervention required.");
          // In non-strict mode, we continue but log the issue
          // In strict mode, we could throw an error here
        }
      }
    } catch (error) {
      logger.Error("Error during version conflict detection:", error);
    }
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
   * @returns {CircularDependencyDetector} The circular dependency detector instance
   */
  public getCircularDependencyDetector(): CircularDependencyDetector {
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
   * Get version conflict detector
   * @returns {VersionConflictDetector} The version conflict detector instance
   */
  public getVersionConflictDetector(): VersionConflictDetector {
    return this.versionConflictDetector;
  }

  /**
   * Preload metadata for components of a specific type
   * Useful before batch registration of a particular component type
   * @param type Component type to preload metadata for (optional, if not provided preloads all)
   * @example
   * // Before registering all controllers:
   * IOC.preloadMetadata('CONTROLLER');
   * const controllers = IOC.listClass('CONTROLLER');
   * controllers.forEach(({target, id}) => IOC.reg(target));
   */
  public preloadMetadata(type?: ComponentType): void {
    const startTime = Date.now();
    
    logger.Info(`Starting metadata preload for ${type || 'all'} components...`);
    
    // Get components to preload for
    const componentsToPreload = type 
      ? this.listClass(type)
      : Array.from(this.classMap.entries()).map(([key, target]) => ({
          id: key,
          target
        }));
    
    if (componentsToPreload.length === 0) {
      logger.Warn(`No components found for type: ${type || 'all'}`);
      return;
    }
    
    // Register frequently accessed metadata keys for preloading
    const preloadKeys: string[] = [];
    
    componentsToPreload.forEach(({ target, id }) => {
      const [, identifier] = id.split(':');
      
      // Common metadata keys that are frequently accessed during injection
      preloadKeys.push(
        // Reflect metadata for constructor parameters
        `reflect:design:paramtypes:${identifier}`,
        // Property injection metadata
        `property:${TAGGED_PROP}:${identifier}`,
        // Class decoration metadata
        `class:${TAGGED_CLS}:${TAGGED_AOP}:${identifier}`,
        // Autowired properties
        `reflect:autowired:${identifier}`,
        // Values properties
        `reflect:values:${identifier}`
      );
      
      // Preload property-specific metadata
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
    
    // Preload metadata using Reflect API
    let preloadedCount = 0;
    this.metadataCache.preload((key: string) => {
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
    
    const preloadTime = Date.now() - startTime;
    const cacheStats = this.metadataCache.getStats();
    
    logger.Info(`Metadata preload completed in ${preloadTime}ms:`);
    logger.Info(`  - Components processed: ${componentsToPreload.length}`);
    logger.Info(`  - Metadata entries preloaded: ${preloadedCount}`);
    logger.Info(`  - Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
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
   * Optimize container performance
   */
  public optimizePerformance(): void {
    logger.Info("Starting container performance optimization...");
    
    const startTime = Date.now();
    
    // Optimize metadata cache
    this.metadataCache.optimize();
    
    // Preload frequently accessed metadata
    this.preloadMetadata();
    
    const optimizationTime = Date.now() - startTime;
    logger.Info(`Container performance optimization completed in ${optimizationTime}ms`);
    
    // Log performance statistics
    const stats = this.getPerformanceStats();
    logger.Info("Performance statistics:", stats);
  }

  /**
   * Register a class or instance to the container.
   * 
   * @param identifier - The identifier string or class/instance to register
   * @param target - Optional target class/instance or options
   * @param options - Optional configuration for the registration
   * @throws {Error} When target is not a class
   * @throws {CircularDependencyError} When circular dependency is detected
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

    if (!this.instanceMap.get(target)) {
      options = {
        isAsync: false,
        initMethod: "constructor",
        destroyMethod: "destructor",
        scope: "Singleton",
        type: "COMPONENT",
        args: [],
        ...{ ...{ type: getComponentTypeByClassName(identifier) }, ...options }
      };

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

        // save class to metadata
        if (!this.getClass(<string>identifier, options.type)) {
          this.saveClass(options.type, <Function>target, <string>identifier);
        }
        // async instance
        if (options.isAsync) {
          this.app.on("appReady", () => this._setInstance(target, options));
        }

        this._setInstance(target, options);
        
        // mark component resolution completed
        this.circularDependencyDetector.finishResolving(identifier);
        
      } catch (error) {
        if (error instanceof CircularDependencyError) {
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

      // get @Autowired decorated properties with caching
      const props = Object.getOwnPropertyNames(target.prototype);
      props.forEach(prop => {
        const metaKey = `${prop}:autowired`;
        let propMetadata = this.metadataCache.getReflectMetadata(metaKey, target);
        
        if (!propMetadata) {
          propMetadata = Reflect.getMetadata(metaKey, target);
          if (propMetadata) {
            this.metadataCache.setReflectMetadata(metaKey, target, propMetadata);
          }
        }
        
        if (propMetadata && propMetadata.identifier) {
          dependencies.push(propMetadata.identifier);
        }
      });

    } catch (error) {
      logger.Debug(`Failed to extract dependencies of ${target.name}:`, error);
    }

    // Cache the extracted dependencies
    this.metadataCache.setCachedDependencies(target, dependencies);
    
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
    const instance = Reflect.construct(<Function>target, options.args);
    overridePrototypeValue(instance);
    if (options.scope === "Singleton") {
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
      injectAOP(<Function>target, (<Function>target).prototype, IOC, options);
      
    } catch (error) {
      // if it is a circular dependency error, throw it again
      if (error instanceof CircularDependencyError) {
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
   * @throws {CircularDependencyError} When circular dependency is detected during resolution
   * 
   * @description
   * Returns singleton instance from cache by default.
   * Creates new instance when:
   * 1. Constructor arguments are provided
   * 2. Component scope is Prototype
   * @example
   * ```ts
   * const userService = container.get('UserService');
   * const userService = container.get(UserService);
   * const userService = container.get(UserService, 'Singleton');
   * const userService = container.get(UserService, 'Prototype', [1, 2, 3]);
   * ```
   */
  public get<T>(identifier: string | Constructor<T>, type?: ComponentType,
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
            const circularError = new CircularDependencyError(
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
        if (error instanceof CircularDependencyError) {
          throw error;
        }
        throw new Error(`Failed to create instance of ${className}: ${error.message}`);
      }
    }

    // Return cached instance for Singleton
    const instance = this.instanceMap.get(<Function>target) as T;
    if (!instance) {
      throw new Error(`Bean ${className} not found`);
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
  public getClass(identifier: string, type: ComponentType = "COMPONENT"): Function {
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
  public saveClass(type: ComponentType, module: Function, identifier: string) {
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
  public listClass(type: ComponentType) {
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
   * Generate version conflict report
   * @returns Version conflict report with detailed information
   */
  public generateVersionConflictReport(): {
    hasConflict: boolean;
    conflictError?: VersionConflictError;
    report: any;
  } {
    const conflict = this.versionConflictDetector.detectVersionConflicts();
    const report = this.versionConflictDetector.generateConflictReport();
    
    return {
      hasConflict: report.hasConflict,
      conflictError: conflict || undefined,
      report
    };
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
      
      // Perform additional version conflict checks at global level
      const versionReport = instance.generateVersionConflictReport();
      if (versionReport.hasConflict) {
        logger.Warn("Global IOC initialization detected version conflicts");
        logger.Warn("Version conflict report:", JSON.stringify(versionReport.report, null, 2));
        
        if (versionReport.conflictError) {
          // Log detailed conflict information
          logger.Warn("Detailed conflict information:");
          logger.Warn(versionReport.conflictError.getConflictDetails());
          
          // Provide resolution suggestions
          const suggestions = versionReport.conflictError.getResolutionSuggestions();
          logger.Info("Resolution suggestions:");
          suggestions.forEach(suggestion => logger.Info(`  ${suggestion}`));
        }
      }
      
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
