/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
export type Scope = 'Singleton' | 'Prototype';
export type ComponentType = 'COMPONENT' | 'CONTROLLER' | 'MIDDLEWARE' | 'SERVICE';

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
  "AfterEach" = "AfterEach"
}

/**
 * Defined constructor interface
 */
export interface Constructor<T> {
  new(...args: any[]): T;
}

/**
 * Application interface for the container.
 * Defines the basic structure and capabilities of an application.
 * 
 * @interface Application
 */
export interface Application {
  env?: string;
  options?: object;

  use?: Function;
  config?: Function;

  /**
   * event
   * @param event 
   * @param callback 
   */
  on?: (event: string, callback: () => void) => any;
  once?: (event: string, callback: () => void) => any;
  /**
  * app metadata
  *
  * @memberof Application
  */
  getMetaData: (key: string) => unknown;
  setMetaData: (key: string, value: unknown) => void;
}

/**
 * Interface representing a context object with metadata management capabilities.
 * 
 * @interface Context
 * @description Provides methods to get and set metadata within a context.
 * @example
 * ```typescript
 * const ctx: Context = {
 *   getMetaData: (key) => someValue,
 *   setMetaData: (key, value) => void
 * };
 * ```
 */
export interface Context {
  /**
  * context metadata
  *
  * @memberof Context
  */
  getMetaData: (key: string) => unknown;
  setMetaData: (key: string, value: unknown) => void;
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
  get<T>(identifier: string | Constructor<T>, type?: ComponentType, ...args: any[]): T;
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
  getClass(identifier: string, type?: ComponentType): Function;
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
  saveClass(type: ComponentType, module: Function, identifier: string): void;
  /**
   * List all registered classes of specified component type.
   * @param type The component type to filter
   * @returns Array of objects containing class id and target class
   */
  listClass(type: ComponentType): {
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
  type?: ComponentType;
  args?: any[];
}

/**
 * Aspect interface
 *
 * @export
 * @interface IAspect
 */
export interface IAspect {
  app: Application;

  run: (...args: any[]) => Promise<any>;
}
