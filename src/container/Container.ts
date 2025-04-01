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
} from "../utils/Util";
import {
  Application,
  ComponentType, Constructor, IContainer,
  ObjectDefinitionOptions, TAGGED_CLS
} from "./IContainer";

/**
 * Container class implements IContainer interface for dependency injection.
 * Manages class instances, metadata, and dependency injection in an IOC container.
 * Uses singleton pattern to ensure only one container instance exists.
 * 
 * Features:
 * - Singleton instance management
 * - Class and instance registration
 * - Metadata management
 * - Dependency injection
 * - Component lifecycle management
 * - Property injection
 * - AOP support
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

  /**
   * Get singleton instance of Container
   * @returns {Container} The singleton instance
   */
  static getInstance() {
    return this.instance || (this.instance = new Container());
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

      // define app as getter
      Reflect.defineProperty((<Function>target).prototype, "app", {
        get: () => this.app,
        configurable: false,
        enumerable: true
      });

      // inject
      this._injection(target, options);
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
   * @private
   */
  private _injection<T extends object | Function>(target: T, options: ObjectDefinitionOptions): void {
    // inject autowired
    injectAutowired(<Function>target, (<Function>target).prototype, IOC, options);
    // inject properties values
    injectValues(<Function>target, (<Function>target).prototype, IOC, options);
    // inject AOP
    injectAOP(<Function>target, (<Function>target).prototype, IOC, options);
  }

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
  public get<T>(identifier: string | Constructor<T>, type?: ComponentType,
    ...args: any[]): T {
    let className;
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
      return null;
    }

    const options = Reflect.get((<Function>target).prototype, "_options");
    const isPrototype = options?.scope === "Prototype";

    // Create new instance when:
    // 1. Explicit args provided
    // 2. OR scope is Prototype (ignore instanceMap)
    if (args.length > 0 || isPrototype) {
      const instance = Reflect.construct(<Function>target, args, <Function>target);
      overridePrototypeValue(<Function>instance);
      return instance as T;
    }

    // Return cached instance for Singleton
    return this.instanceMap.get(<Function>target) as T;
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
  public saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    originMap.set(decoratorNameKey, data);
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
  }

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
  public getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object,
    propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    return originMap.get(decoratorNameKey);
  }

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
  public savePropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    originMap.set(propertyName, data);
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
  }

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
  public getPropertyData(decoratorNameKey: string | symbol, target: Function | object,
    propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    return originMap.get(propertyName);
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
}

/**
 * Global IOC container instance.
 * Singleton pattern implementation to ensure only one container instance exists.
 * Throws error if multiple versions of koatty_container are detected.
 * 
 * @constant
 * @type {Container}
 * @throws {Error} When multiple container versions conflict
 */
export const IOC: IContainer = (function () {
    // Check global object first
    if ((<any>global).__KOATTY_IOC__) {
      return (<any>global).__KOATTY_IOC__;
    }
    // First initialization
    const instance = Container.getInstance();
  (<any>global).__KOATTY_IOC__ = instance;
    return instance;
})();

/**
 * IOC container instance export.
 * Alias for IOC
 * @type {Container}
 */
export const IOCContainer = IOC;
