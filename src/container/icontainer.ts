/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
import { Application } from "./app";

export type Scope = 'Singleton' | 'Prototype';

// used to store class properties aop
export const TAGGED_AOP = 'TAGGED_AOP';

// used to store class properties args (value)
export const TAGGED_ARGS = 'TAGGED_ARGS';

// used to store class to be injected
export const TAGGED_CLS = 'TAGGED_CLS';

// used to store class properties tags (autowired)
export const TAGGED_PROP = 'TAGGED_PROP';

// used to store class properties parameters (get/post...)
export const TAGGED_PARAM = 'TAGGED_PARAM';

// used to store class method to be injected
export const TAGGED_METHOD = 'TAGGED_METHOD';

export type ClassOrString<T> = string | (new () => T);

// Forward declaration for CircularDepDetector
export interface CircularDepDetector {
  registerComponent(identifier: string, className: string, dependencies?: string[]): void;
  addDependency(from: string, to: string): void;
  startResolving(identifier: string): void;
  finishResolving(identifier: string): void;
  detectCircularDependency(identifier: string): string[] | null;
  getAllCircularDependencies(): string[][];
  hasCircularDependencies(): boolean;
  getResolutionSuggestions(circularPath: string[]): string[];
  generateDependencyReport(): {
    totalComponents: number;
    resolvedComponents: number;
    circularDependencies: string[][];
    unresolvedComponents: string[];
  };
  getDependencyGraphVisualization(): string;
  getTransitiveDependencies(identifier: string): string[];
  clear(): void;
}

/**
 * defined AOP type
 *
 * @export
 * @enum {number}
 */
export enum AOPType {
  "Before" = "Before",
  "BeforeEach" = "BeforeEach",
  "After" = "After",
  "AfterEach" = "AfterEach",
  "Around" = "Around",
  "AroundEach" = "AroundEach"
}

/**
 * Defined constructor interface
 */
export interface Constructor<T> {
  new(...args: any[]): T;
}

/**
 * Interface for IOC container implementation.
 * Provides methods for dependency injection, metadata management,
 * and component registration/retrieval.
 * 
 * @interface IContainer
 */
export interface IContainer {
  /**
   * Set application instance
   * @param app Application instance
   */
  setApp(app: Application): void;
  /**
   * Get the application instance.
   * 
   * @returns {any} The application instance
   */
  getApp(): Application;
  /**
   * Register a class or instance to the container.
   * 
   * @param identifier - The identifier string or class/instance to register
   * @param target - Optional target class/instance or options
   * @param options - Optional configuration for the registration
   * @throws {Error} When target is not a class
   * 
   * @example
   * ```ts
   * container.reg('UserService', UserService);
   * container.reg(UserService);
   * container.reg(UserService, { scope: 'Singleton' });
   * ```
   */
  reg<T extends object | Function>(identifier: string | T, target?: T | ObjectDefinitionOptions,
    options?: ObjectDefinitionOptions): void;

  /**
   * Get component instance by identifier.
   * 
   * @param identifier - Class constructor or class name string
   * @param type - Component type (COMPONENT/CONTROLLER/MIDDLEWARE/SERVICE)
   * @param args - Constructor arguments
   * @returns Component instance or null if not found
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
  get<T>(identifier: string | Constructor<T>, type?: string, ...args: any[]): T;
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
  getClass(identifier: string, type?: string): Function;
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
  getInsByClass<T extends object | Function>(target: T, args?: any[]): T;
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
  getMetadataMap(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol): any;
  /**
   * Get the identifier for a target class or object.
   * 
   * @param target The target class constructor function or object instance
   * @returns The identifier string. For functions, returns the tagged metadata id or function name.
   *          For objects, returns the constructor name.
   */
  getIdentifier(target: Function | object): string;
  /**
   * Get the component type of target class or object.
   * 
   * @param target The target class constructor or object instance
   * @returns The component type string
   */
  getType(target: Function | object): any;
  /**
   * Save class metadata and store class module in container.
   * 
   * @param type The component type
   * @param module The class module to be saved
   * @param identifier The unique identifier for the class
   */
  saveClass(type: string, module: Function, identifier: string): void;
  /**
   * List all registered classes of specified component type.
   * @param type The component type to filter
   * @returns Array of objects containing class id and target class
   */
  listClass(type: string): {
    id: string;
    target: Function;
  }[];
  /**
   * Save class metadata to the container.
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
  saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string): void;
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
  attachClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string): void;
  /**
   * Get metadata value by type and decorator key.
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
  getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object, propertyName?: string): any;
  /**
   * Save property metadata to the container.
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
  savePropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol): void;
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
  attachPropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol): void;
  /**
   * Get property metadata by decorator name key.
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
  getPropertyData(decoratorNameKey: string | symbol, target: Function | object, propertyName: string | symbol): any;
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
  listPropertyData(decoratorNameKey: string | symbol, target: Function | object): any;

  /**
   * clear all resources in container
   * @memberof Container
   */
  clear(): void;

  /**
   * Clear only instances while preserving class registrations and metadata
   * This is useful for tests that need to reset state but keep decorator metadata
   * @memberof Container
   */
  clearInstances(): void;

  /**
   * Get circular dependency detector
   * @returns {CircularDepDetector} The circular dependency detector instance
   */
  getCircularDependencyDetector(): CircularDepDetector;

  /**
   * Generate and log dependency analysis report
   */
  generateDependencyReport(): void;

  /**
   * Check for circular dependencies in the container
   * @returns {boolean} True if circular dependencies exist
   */
  hasCircularDependencies(): boolean;

  /**
   * Get all circular dependencies
   * @returns {string[][]} Array of circular dependency paths
   */
  getCircularDependencies(): string[][];

  /**
   * 🚀 性能优化：统一的元数据预加载和性能优化方法
   * 集成了所有性能优化功能，默认开启优化
   * @param types 组件类型数组，如果为空则处理所有类型
   * @param options 预加载选项，默认开启所有优化
   */
  preloadMetadata(types?: string[], options?: {
    optimizePerformance?: boolean;
    warmupCaches?: boolean;
    batchPreProcessDependencies?: boolean;
    clearStaleCache?: boolean;
  }): void;

  /**
   * Get performance statistics including cache hit rates and memory usage
   * @returns Performance statistics object
   */
  getPerformanceStats(): {
    cache: any;
    totalRegistered: number;
    memoryUsage: {
      classMap: number;
      instanceMap: number;
      metadataMap: number;
    };
  };

  /**
   * Batch register components
   */
  batchRegister(components: { target: Function, identifier?: string, options?: ObjectDefinitionOptions }[], 
                batchOptions?: { preProcessDependencies?: boolean, warmupAOP?: boolean }): void;

  /**
   * Get detailed performance statistics
   */
  getDetailedPerformanceStats(): any;

  /**
   * Clear performance cache
   */
  clearPerformanceCache(): void;
}


/**
 * BeanFactory Object interface
 *
 * @export
 * @interface ObjectDefinitionOptions
 */
export interface ObjectDefinitionOptions {
  isAsync?: boolean;
  initMethod?: string;
  destroyMethod?: string;
  scope?: Scope;
  type?: string;
  args?: any[];
}

/**
 * AOP Aspect execution context.
 * Provides a unified interface to access and modify method execution context.
 * 
 * Inspired by Spring's ProceedingJoinPoint, this context object:
 * - Ensures parameter consistency across all aspect types (Before, Around, After)
 * - Provides immutable access to original parameters
 * - Allows controlled parameter modification
 * - Includes method and target metadata
 * 
 * @export
 * @interface AspectContext
 * @example
 * ```typescript
 * @Aspect()
 * export class LoggingAspect implements IAspect {
 *   app: any;
 *   
 *   async run(context: AspectContext, proceed?: Function): Promise<any> {
 *     console.log('Method:', context.getMethodName());
 *     console.log('Args:', context.getArgs());
 *     
 *     // Modify arguments
 *     const args = context.getArgs();
 *     args[0] = args[0].trim();
 *     context.setArgs(args);
 *     
 *     if (proceed) {
 *       return await proceed();
 *     }
 *   }
 * }
 * ```
 */
export interface AspectContext {
  /**
   * Get the target object instance being intercepted.
   * 
   * @returns The target object instance
   */
  getTarget(): any;

  /**
   * Get the name of the intercepted method.
   * 
   * @returns Method name as string
   */
  getMethodName(): string;

  /**
   * Get the current arguments (may have been modified by previous aspects).
   * Returns a reference to the mutable arguments array.
   * 
   * @returns Current arguments array
   * @example
   * ```typescript
   * const args = context.getArgs();
   * args[0] = 'modified'; // Modifies the actual arguments
   * ```
   */
  getArgs(): any[];

  /**
   * Set new arguments for the method execution.
   * This will affect subsequent aspects and the original method.
   * 
   * @param args - New arguments array
   * @example
   * ```typescript
   * context.setArgs(['new', 'arguments']);
   * ```
   */
  setArgs(args: any[]): void;

  /**
   * Get the original arguments passed to the method (immutable).
   * This provides access to the arguments before any aspect modifications.
   * 
   * @returns Readonly copy of original arguments
   * @example
   * ```typescript
   * const original = context.getOriginalArgs();
   * // original cannot be modified
   * ```
   */
  getOriginalArgs(): readonly any[];

  /**
   * Get custom options passed from the decorator.
   * 
   * @returns Options object or undefined
   * @example
   * ```typescript
   * // With decorator: @Around(MyAspect, { timeout: 3000 })
   * const timeout = context.getOptions()?.timeout; // 3000
   * ```
   */
  getOptions(): any;

  /**
   * Get application instance reference.
   * 
   * @returns Application instance or undefined
   */
  getApp(): Application | undefined;
}

/**
 * Aspect interface for AOP (Aspect-Oriented Programming) implementation.
 * 
 * Aspects are used to add cross-cutting concerns (logging, security, transactions, etc.)
 * to methods without modifying their core business logic.
 * 
 * This interface uses AspectContext to provide a unified and type-safe way to access
 * method metadata, arguments, and execution context.
 *
 * @export
 * @interface IAspect
 * @example
 * ```typescript
 * @Aspect()
 * export class LoggingAspect implements IAspect {
 *   app: any;
 *   
 *   async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
 *     console.log('Method:', context.getMethodName());
 *     console.log('Args:', context.getArgs());
 *     
 *     if (proceed) {
 *       const result = await proceed();
 *       console.log('Result:', result);
 *       return result;
 *     }
 *   }
 * }
 * ```
 */
export interface IAspect {
  /**
   * Application instance reference.
   * Provides access to the application context within the aspect.
   */
  app: Application;

  /**
   * Main execution method for the aspect with AspectContext support.
   * 
   * @param context - Aspect execution context providing:
   *                  - Method metadata (name, target object)
   *                  - Current arguments (mutable via setArgs)
   *                  - Original arguments (immutable)
   *                  - Custom options from decorator
   *                  - Application instance
   * 
   * @param proceed - Optional function to execute the original method or next aspect.
   *                  - For **Before/After** aspects: This is `undefined`
   *                  - For **Around** aspects: Must be called to execute the original method
   *                    * Automatically uses current args from context
   *                    * Can be wrapped for error handling, timing, etc.
   * 
   * @returns Promise resolving to:
   *          - For **Around** aspects: The result from `proceed()` (possibly modified)
   *          - For **Before** aspects: Return value is ignored
   *          - For **After** aspects: Return value is ignored
   * 
   * @example Before aspect - validation
   * ```typescript
   * async run(context: AspectContext): Promise<any> {
   *   const args = context.getArgs();
   *   if (!args[0]) {
   *     throw new Error('First argument is required');
   *   }
   * }
   * ```
   * 
   * @example Around aspect - parameter modification
   * ```typescript
   * async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
   *   // Modify arguments
   *   const args = context.getArgs();
   *   args[0] = args[0].trim().toUpperCase();
   *   context.setArgs(args);
   *   
   *   // Execute with modified args
   *   if (proceed) {
   *     return await proceed();
   *   }
   * }
   * ```
   * 
   * @example Around aspect - error handling and timing
   * ```typescript
   * async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
   *   const startTime = Date.now();
   *   try {
   *     const result = await proceed?.();
   *     console.log(`${context.getMethodName()} took ${Date.now() - startTime}ms`);
   *     return result;
   *   } catch (error) {
   *     console.error(`${context.getMethodName()} failed:`, error);
   *     throw error;
   *   }
   * }
   * ```
   * 
   * @example After aspect - accessing execution context
   * ```typescript
   * async run(context: AspectContext): Promise<any> {
   *   console.log('Method executed:', context.getMethodName());
   *   console.log('Final args:', context.getArgs());
   *   console.log('Original args:', context.getOriginalArgs());
   * }
   * ```
   */
  run(context: AspectContext, proceed?: () => Promise<any>): Promise<any>;
}
