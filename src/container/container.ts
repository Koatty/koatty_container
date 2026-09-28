import { AsyncLocalStorage } from "async_hooks";
/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
// tslint:disable-next-line: no-import-side-effect
import * as helper from "koatty_lib";
import "reflect-metadata";
import { injectAOP } from "../processor/aop_processor";
import {
  injectAutowired
} from "../processor/autowired_processor";
import { injectValues } from "../processor/values_processor";
import {
  getComponentTypeByClassName,
  overridePrototypeValue
} from "../utils/operator";
import {
  Constructor, IContainer, IContainerDiagnostics,
  ObjectDefinitionOptions, TAGGED_CLS, TAGGED_ARGS, TAGGED_PROP
} from "./icontainer";
import {
  createDualClassDecorator,
  createDualMethodDecorator,
  createDualFieldDecorator
} from "../decorator/compat";
import { MetadataStore } from "./metadata_store";
import { LifecycleManager } from "./lifecycle_manager";
import { DependencyAnalyzer } from "./dependency_analyzer";
import { PreloadManager } from "./preload_manager";
import { BatchRegistrar } from "./batch_registrar";


// import circular dependency detector
import { CircularDepDetector, CircularDepError } from "../utils/circular";
import { MetadataCache } from "../utils/cache";
import { DefaultLogger as logger } from "koatty_logger";
import { App, Application } from "./app";
import { PerformanceManager } from "./performance_manager";

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
export class Container implements IContainer, IContainerDiagnostics {
  private app: Application;
  private classMap: Map<string, Function>;
  private classIdentities = new WeakMap<object, { id: string; type: string }>();
  private lifecycleManager: LifecycleManager;
  private static instance: Container;

  // circular dependency detector
  private circularDependencyDetector: CircularDepDetector;

  // performance optimization components
  private metadataCache: MetadataCache;
  private metadataStore: MetadataStore;
  private dependencyAnalyzer: DependencyAnalyzer;
  private performanceManager: PerformanceManager;
  private preloadManager: PreloadManager;
  private batchRegistrar: BatchRegistrar;

  /**
   * Get singleton instance of Container.
   *
   * This is the *default* container.
   *
   * @returns {Container} The singleton instance
   */
  static getInstance(): Container {
    if (!this.instance) {
      this.instance = new Container({ shared: true });
    }
    return this.instance;
  }

  /**
   * Constructor for Container class.
   *
   * Prefer `Container.getInstance()` for the default container, or
   * `new Container()` for an isolated one.
   *
   * @param opts.shared - when true, reuse the process-wide shared
   *   `MetadataCache` (used by the default container).
   */
  constructor(opts: { shared?: boolean } = {}) {
    const shared = opts.shared === true;
    this.app = new App();
    this.classMap = new Map();
    this.lifecycleManager = new LifecycleManager((target, instance, options) => this.prepareInstance(target, instance, options));
    this.circularDependencyDetector = new CircularDepDetector();

    this.metadataCache = shared
      ? MetadataCache.getShared()
      : new MetadataCache(MetadataCache.getSharedOptions());
    this.metadataStore = new MetadataStore(this.metadataCache);
    this.dependencyAnalyzer = new DependencyAnalyzer(
      this.circularDependencyDetector,
      this.metadataCache,
      (id, type) => this.getClass(id, type),
      (key, target) => this.listPropertyData(key, target)
    );
    this.performanceManager = new PerformanceManager(
      this.metadataCache,
      this.classMap,
      this.circularDependencyDetector,
      (type) => this.listClass(type)
    );
    this.preloadManager = new PreloadManager(
      this.metadataCache,
      (type) => this.listClass(type),
      () => this.getDetailedPerformanceStats(),
      () => this.clearPerformanceCache(),
      (lruCaches) => this.performanceManager.calculateTotalCacheSize(lruCaches),
      this.classMap,
      this as any
    );
    this.batchRegistrar = new BatchRegistrar(
      (id, target, options) => this.reg(id, target, options),
      (target) => this.getIdentifier(target),
      (target) => this.getType(target),
      (target) => this.extractDependencies(target),
      (types, options) => this.preloadMetadata(types, options)
    );

    logger.Debug("Container initialized with metadata cache");
  }

  /**
   * Resolve the request context currently in scope (ARCH-02 / D-2).
   *
   * Prefers an explicitly bound context (set via `runInRequestScope`), then
   * falls back to the application's AsyncLocalStorage-backed
   * `getCurrentContext()`. Returns `undefined` outside a request.
   */
  private requestStorage = new AsyncLocalStorage<object>();
  private definitions = new Map<Function, ObjectDefinitionOptions>();
  private constructing = new Map<Function, any>();
  private requestManagers = new WeakMap<object, LifecycleManager>();
  private getRequestContext(): object | undefined {
    return this.requestStorage.getStore() ?? (this.app as any)?.getCurrentContext?.();
  }

  public runInRequestScope<T>(ctx: object, fn: () => T): T {
    const storage = (this.app as any)?.ctxStorage;
    return storage?.run ? storage.run(ctx, fn) : this.requestStorage.run(ctx, fn);
  }

  public readyRequestScope(ctx: object): Promise<void> | undefined {
    const manager = this.requestManagers.get(ctx);
    return manager?.hasLifecycleHooks ? manager.ready() : undefined;
  }
  public async releaseRequestScope(ctx: object): Promise<void> {
    const manager = this.requestManagers.get(ctx);
    this.requestManagers.delete(ctx);

    await manager?.clear();
  }

  private metadataRevision = 0;
  private plainClasses = new WeakMap<Function, { revision: string; plain: boolean }>();

  private prepareInstance(target: Function, instance: any, options: ObjectDefinitionOptions): void {
    Object.defineProperty(instance, 'app', { value: this.app, configurable: true, writable: true, enumerable: true });
    Object.defineProperty(instance, '_options', { value: options, configurable: true });
    const revision = `${this.metadataRevision}:${(IOC as Container)?.metadataRevision ?? 0}`;
    let plan = this.plainClasses.get(target);
    if (!plan || plan.revision !== revision) {
      let plain = true;
      for (let cls: any = target; cls && cls !== Function.prototype; cls = Object.getPrototypeOf(cls)) {
        if (Object.keys(this.listPropertyData(TAGGED_PROP, cls) ?? {}).length ||
            Object.keys(this.listPropertyData(TAGGED_ARGS, cls) ?? {}).length ||
            Object.getOwnPropertyNames(cls.prototype ?? {}).some(key => key !== 'constructor' &&
              typeof Object.getOwnPropertyDescriptor(cls.prototype, key)?.value === 'function')) { plain = false; break; }
      }
      plan = { revision, plain };
      this.plainClasses.set(target, plan);
    }
    if (plan.plain) return;
    this.constructing.set(target, instance);
    try {
      injectAutowired(target, instance, this, options);
      injectValues(target, instance, this, options);
      injectAOP(target, this, instance);
    } finally { this.constructing.delete(target); }
  }

  /**
   * Set application instance
   * @param app Application instance
   */
  private deferredInstances = new Map<object | Function, ObjectDefinitionOptions>();
  private lifecycleApps = new WeakSet<object>();
  public setApp(app: Application) {
    this.app = app;
    if (app && !this.lifecycleApps.has(app)) {
      this.lifecycleApps.add(app);
      app.once?.('appReady', () => this.ready());
      // Koatty drains other resources before disposing its container. Lightweight
      // EventEmitter embedders can await this listener through their lifecycle dispatcher.
      if (typeof (app as any).stopResources !== 'function') app.once?.('appStop', () => this.clear());
    }
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
    this.preloadManager.preloadMetadata(types, options);
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    cache: Record<string, unknown>;
    totalRegistered: number;
    memoryUsage: {
      classMap: number;
      instanceMap: number;
      metadataMap: number;
    };
  } {
    return this.performanceManager.getPerformanceStats();
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

    if (!target || !helper.isClass(target)) {
      throw new Error("target is not a class");
    }

    // Check if this specific identifier is already registered, not the target class
    const hasExistingInstance = this.lifecycleManager.getInstance(target);

    const defaultType = getComponentTypeByClassName(identifier);
    options = {
      isAsync: false,
      initMethod: "constructor",
      destroyMethod: "destructor",
      scope: "Singleton",
      type: defaultType,
      args: [],
      ...options
    };

    // Always try to save class to metadata with the new identifier
    const type = options.type ?? "COMPONENT";
    if (!this.getClass(<string>identifier, type)) {
      this.saveClass(type, <Function>target, <string>identifier);
    }

    // Only do the heavy initialization if instance doesn't exist
    {
      const dependencies = this.extractDependencies(target);

      // Strict Lifetime check: Singleton cannot depend on Prototype (opt-in)
      if (options.strictLifetime === true && options.scope === 'Singleton') {
        this.checkStrictLifetime(identifier as string, dependencies, options.type ?? 'COMPONENT');
      }

      // ARCH-02 / D-2: Singleton depending on a Request-scoped bean is always a
      // scope violation. Request scope is new in this release, so enforcing it
      // unconditionally cannot break existing applications.
      if (options.scope === 'Singleton') {
        this.checkNoRequestScopeDependency(identifier as string, dependencies);
      }

      try {
        // register component to circular dependency detector
        this.circularDependencyDetector.registerComponent(
          identifier,
          (target as Function).name,
          dependencies
        );

        this.definitions.set(target as Function, options);
        if (options.scope === 'Singleton' && !hasExistingInstance) {
          if (options.isAsync) this.deferredInstances.set(target, options);
          else this._setInstance(target, options);
        }

        this.circularDependencyDetector.detectCircularDependency(identifier as string);
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
    }
  }

  /**
   * Extract the dependencies of a class with caching
   * @param target The target class
   * @returns {string[]} An array of dependencies
   */
  private extractDependencies(target: any): string[] {
    return this.dependencyAnalyzer.extractDependencies(target);
  }

  /**
   * Check strict lifetime constraint: Singleton cannot depend on Prototype
   * @param id The identifier of the component being registered
   * @param dependencies Array of dependency identifiers
   * @param type The component type
   * @throws {Error} When Singleton depends on Prototype
   * @private
   */
  private checkStrictLifetime(id: string, dependencies: string[], _type: string): void {
    for (const name of dependencies) {
      const cls = this.getClass(name, getComponentTypeByClassName(name));
      if (cls && (this.definitions.get(cls)?.scope ?? Reflect.get(cls.prototype, '_options')?.scope) === 'Prototype') throw new Error(`Strict Mode: Singleton '${id}' cannot depend on Prototype '${name}'`);
    }
  }

  /**
   * Fail fast when a Singleton declares a Request-scoped dependency
   * (ARCH-02 / D-2).
   */
  private checkNoRequestScopeDependency(id: string, dependencies: string[]): void {
    for (const name of dependencies) {
      const cls = this.getClass(name, getComponentTypeByClassName(name));
      if (cls && (this.definitions.get(cls)?.scope ?? Reflect.get(cls.prototype, '_options')?.scope) === 'Request') {
        throw new Error(`Scope violation: Singleton '${id}' cannot depend on Request-scoped '${name}'. Use a Request-scoped consumer.`);
      }
    }
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
    this.lifecycleManager.setInstance(target, options);
  }

  /**
   * Perform dependency injection on the target class.
   * 
   * @param target The target class to inject dependencies into
   * @param options Configuration options for dependency injection
   * @param identifier Component identifier for circular dependency detection
   * @private
   */

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
  public get<T>(identifier: string | Constructor<T>, type?: string, ...args: any[]): T {
    const className = typeof identifier === 'function' ? this.getIdentifier(identifier) : identifier;
    const target = this.getClass(className, type ?? getComponentTypeByClassName(className));
    if (!target) throw new Error(`Bean ${className} not found`);
    const options = this.definitions.get(target) ?? this.getPropertyData<any>('SERVICE_OPTIONS', target, className)
      ?? Reflect.get(target.prototype, '_options') ?? { scope: 'Singleton' };
    const scope = options.scope ?? 'Singleton';
    const ctx = this.getRequestContext();
    if (scope === 'Request' && !ctx) throw new Error(`Request-scoped bean ${className} requires an active request context`);
    for (const owner of this.constructing.keys()) {
      if (scope === 'Request' && (this.definitions.get(owner)?.scope ?? 'Singleton') === 'Singleton') {
        throw new Error(`Scope violation: Singleton '${owner.name}' cannot depend on Request-scoped '${className}'`);
      }
    }
    if (this.constructing.has(target)) return this.constructing.get(target);
    if (this.deferredInstances.has(target)) throw new Error(`Async component ${className} is not ready; await container.ready() before resolving it`);
    if (scope === 'Request') {
      let manager = this.requestManagers.get(ctx!);
      if (!manager) {
        manager = new LifecycleManager((cls, instance, opts) => this.prepareInstance(cls, instance, opts));
        this.requestManagers.set(ctx!, manager);
      }
      manager.setInstance(target, { ...options, args: args.length ? args : options.args });
      return manager.getInstance(target) as T;
    }
    if (scope === 'Prototype' || args.length) {
      const instance = Reflect.construct(target, args.length ? args : options.args ?? []);
      overridePrototypeValue(instance);
      this.prepareInstance(target, instance, options);
      if (ctx) {
        let manager = this.requestManagers.get(ctx);
        if (!manager) { manager = new LifecycleManager(); this.requestManagers.set(ctx, manager); }
        manager.trackInstance(instance, options);
      } else this.lifecycleManager.trackInstance(instance, options);
      return instance;
    }
    this.lifecycleManager.setInstance(target, options);
    return this.lifecycleManager.getInstance(target) as T;
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
  public getClass(identifier: string, type: string = "COMPONENT"): Function | undefined {
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
    if (!helper.isClass(target)) throw new Error('getInsByClass: target is not a class');
    const cls = target as unknown as Function;
    const id = this.getIdentifier(cls);
    const type = this.getType<string>(cls);
    if (!this.getClass(id, type)) {
      if (!args.length) return undefined as unknown as T;
      const instance = Reflect.construct(cls, args);
      this.prepareInstance(cls, instance, { scope: 'Prototype', type });
      return instance;
    }
    if (!args.length && (this.definitions.get(cls)?.scope ?? 'Singleton') === 'Singleton') {
      return this.lifecycleManager.getInstance(cls) as unknown as T;
    }
    return this.get(id, type, ...args) as T;
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
  public getMetadataMap<T = any>(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol): T {
    return this.metadataStore.getMetadataMap<T>(metadataKey, target, propertyKey);
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
      const metaData = this.classIdentities.get(target) ?? Reflect.getOwnMetadata(TAGGED_CLS, target);
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
  public getType<T = string>(target: Function | object): T {
    const metaData = this.classIdentities.get(target) ?? Reflect.getOwnMetadata(TAGGED_CLS, target);
    if (metaData) {
      return metaData.type as T;
    }
    const identifier = (<Function>target).name || (target.constructor ? target.constructor.name : "");
    return getComponentTypeByClassName(identifier) as T;
  }

  /**
   * Save class metadata and store class module in container.
   * 
   * @param type The component type
   * @param module The class module to be saved
   * @param identifier The unique identifier for the class
   */
  public saveClass(type: string, module: Function, identifier: string) {
    this.classIdentities.set(module, { id: identifier, type });
    if (this === IOC) Reflect.defineMetadata(TAGGED_CLS, { id: identifier, type }, module);
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
    this.metadataRevision++;
    this.metadataStore.saveClassMetadata(type, decoratorNameKey, data, target, propertyName);
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
  public getClassMetadata<T = any>(type: string, decoratorNameKey: string | symbol, target: Function | object,
    propertyName?: string): T {
    return this.metadataStore.getClassMetadata<T>(type, decoratorNameKey, target, propertyName)
      ?? (this !== IOC ? IOC.getClassMetadata<T>(type, decoratorNameKey, target, propertyName) : undefined as T);
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
    this.metadataRevision++;
    this.metadataStore.attachClassMetadata(type, decoratorNameKey, data, target, propertyName);
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
    this.metadataRevision++;
    this.metadataStore.savePropertyData(decoratorNameKey, data, target, propertyName);
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
    this.metadataRevision++;
    this.metadataStore.attachPropertyData(decoratorNameKey, data, target, propertyName);
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
  public getPropertyData<T = any>(decoratorNameKey: string | symbol, target: Function | object,
    propertyName: string | symbol): T {
    return this.metadataStore.getPropertyData<T>(decoratorNameKey, target, propertyName)
      ?? (this !== IOC ? IOC.getPropertyData<T>(decoratorNameKey, target, propertyName) : undefined as T);
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
  public listPropertyData<T = Record<string, any>>(decoratorNameKey: string | symbol, target: Function | object): T {
    return { ...(this !== IOC ? IOC.listPropertyData(decoratorNameKey, target) : {}),
      ...this.metadataStore.listPropertyData(decoratorNameKey, target) } as T;
  }

  /**
   * Generate and log dependency analysis report
   */
  public generateDependencyReport(): void {
    return this.dependencyAnalyzer.generateDependencyReport();
  }

  /**
   * Check for circular dependencies in the container
   * @returns {boolean} True if circular dependencies exist
   */
  public hasCircularDependencies(): boolean {
    return this.dependencyAnalyzer.hasCircularDependencies();
  }

  /**
   * Get all circular dependencies
   * @returns {string[][]} Array of circular dependency paths
   */
  public getCircularDependencies(): string[][] {
    return this.dependencyAnalyzer.getCircularDependencies();
  }

  /**
   * clear all resources in container
   * @memberof Container
   */
  public async ready(): Promise<void> {
    const pending = [...this.deferredInstances];
    this.deferredInstances.clear();
    for (const [target, options] of pending) this._setInstance(target, options);
    for (const [target, options] of this.definitions) {
      if (options.scope !== 'Singleton') continue;
      for (const dep of Object.values(this.listPropertyData<any>('TAGGED_PROP', target))) {
        const name = (dep as any).identifier;
        const cls = this.getClass(name, (dep as any).type) ?? this.getClass(name, getComponentTypeByClassName(name));
        if (cls && this.definitions.get(cls)?.scope === 'Request') throw new Error(`Scope violation: Singleton '${target.name}' cannot depend on Request-scoped '${name}'`);
      }
    }
    await this.lifecycleManager.ready();
  }

  public seal(): void { this.lifecycleManager.seal(); }

  public clear(): Promise<void> {
    this.classMap.clear();
    this.classIdentities = new WeakMap();
    this.definitions.clear();
    this.app = new App();
    const disposed = this.lifecycleManager.clear();
    this.deferredInstances.clear();
    this.circularDependencyDetector.clear();

    this.metadataStore.clear();

    logger.Debug("Container cleared including performance optimization components");
    return disposed;
  }

  /**
   * Clear metadata while preserving class registrations and instances
   * This is useful for tests that need to reset state but keep decorator metadata
   * @memberof Container
   */
  public clearMetadata(): void {
    this.metadataStore.clear();

    logger.Debug("Container metadata cleared");
  }

  /**
   * Clear class registrations while preserving instances and metadata
   * This is useful for tests that need to reset state but keep decorator metadata
   * @memberof Container
   */
  public clearClass(): void {
    this.classMap.clear();
    this.classIdentities = new WeakMap();
    logger.Debug("Container class cleared");
  }

  /**
   * Clear only instances while preserving class registrations and metadata
   * This is useful for tests that need to reset state but keep decorator metadata
   * @memberof Container
   */

  public clearInstances(): Promise<void> {
    const disposed = this.lifecycleManager.clear();
    this.circularDependencyDetector.clear();

    logger.Debug("Container instances cleared, class registrations and metadata preserved");
    return disposed;
  }

  /**
   * Dispose the container and release all resources.
   * Implements TC39 Explicit Resource Management (using declaration).
   * Available in Node.js 20+ and TypeScript 5.2+
   * 
   * @example
   * ```ts
   * {
   *   using container = Container.getInstance();
   *   // container is automatically disposed when leaving scope
   * }
   * ```
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    try { await this.clear(); } finally { this.metadataCache.stopCleanupTimer(); }
  }

  public [Symbol.dispose](): void {
    // Synchronous using cannot await async hooks. Use await using for deterministic cleanup.
    this.clear().catch(error => logger.Error('Async container disposal failed; use await using', error));
    this.metadataCache.stopCleanupTimer();
    logger.Debug('Container disposed via Symbol.dispose');
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
    };
    lruCaches: {
      metadata: any;
      dependencies?: any;
      aop?: any;
    };
  } {
    return this.performanceManager.getDetailedPerformanceStats();
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
    this.batchRegistrar.batchRegister(components, batchOptions);
  }

  /**
   * Clear performance cache
   */
  public clearPerformanceCache(): void {
    this.performanceManager.clearPerformanceCache();
  }

  /**
   * Create a decorator that works with both legacy and TC39 signatures.
   * Dispatches to the appropriate compat helper based on `type`.
   *
   * @param handler - The decorator handler function (or {legacy, tc39} object for field type)
   * @param type - Decorator type: 'class', 'method', or 'field'
   */
  public createDecorator(handler: any, type: string): any {
    switch (type) {
      case 'class':
        return createDualClassDecorator(handler);
      case 'method':
        return createDualMethodDecorator(handler);
      case 'field':
        if (handler && typeof handler === 'object' && 'legacy' in handler && 'tc39' in handler) {
          return createDualFieldDecorator(handler.legacy, handler.tc39);
        }
        throw new Error("Field decorator requires { legacy, tc39 } handler object");
      default:
        throw new Error(`Unknown decorator type: ${type}`);
    }
  }
}

const KOATTY_IOC_KEY = Symbol.for('koatty.ioc.v2');

/**
 * Global IOC container instance.
 * 
 * @constant
 * @type {Container}
 */
export const IOC: IContainer = (() => {
  const existing = (globalThis as any)[KOATTY_IOC_KEY];
  if (existing) {
    return existing;
  }
  const instance = Container.getInstance();
  (globalThis as any)[KOATTY_IOC_KEY] = instance;
  return instance;
})();

/**
 * IOC container instance export.
 * Alias for IOC
 * @type {Container}
 */
export const IOCContainer = IOC;
