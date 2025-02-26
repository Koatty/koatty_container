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
 * IOC Container
 *
 * @export
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
   * Static method to get the singleton instance of a class
   *
   * @static
   * @returns
   */
  static getInstance() {
    return this.instance || (this.instance = new Container());
  }

  /**
   * creates an instance of Container.
   * @param {*} app
   * @memberof Container
   */
  private constructor() {
    this.app = Object.create(null);
    this.classMap = new Map();
    this.instanceMap = new WeakMap();
    this.metadataMap = new WeakMap();
  }

  /**
   * set app
   *
   * @param {Koatty} app
   * @returns
   * @memberof Container
   */
  public setApp(app: Application) {
    this.app = app;
  }

  /**
   * get app
   *
   * @returns
   * @memberof Container
   */
  public getApp() {
    return this.app;
  }

  /**
   * registering an instance of a class to an IOC container.
   *
   * @template T
   * @param {T} target
   * @param {ObjectDefinitionOptions} [options]
   * @returns {void}
   * @memberof Container
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
   * save instance to instanceMap
   * @param target 
   * @param options 
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
   * @description: injection prototype
   * @param {T} target
   * @param {ObjectDefinitionOptions} options
   * @return {*}
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
   * get instance from IOC container.
   *
   * @param {string} identifier
   * @param {ComponentType} [type="COMPONENT"]
   * @param {any[]} [args=[]]
   * @returns {*}
   * @memberof Container
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
   * get class from IOC container by identifier.
   *
   * @param {string} identifier
   * @param {ComponentType} [type="COMPONENT"]
   * @returns {Function}
   * @memberof Container
   */
  public getClass(identifier: string, type: ComponentType = "COMPONENT"): Function {
    return this.classMap.get(`${type}:${identifier}`);
  }

  /**
   * get instance from IOC container by class.
   *
   * @template T
   * @param {T} target
   * @param {any[]} [args=[]]
   * @returns {T}
   * @memberof Container
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
   * get metadata from class
   *
   * @static
   * @param {(string | symbol)} metadataKey
   * @param {(Function | object)} target
   * @param {(string | symbol)} [propertyKey]
   * @returns
   * @memberof Injectable
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
   * get identifier from class
   *
   * @param {Function | Object} target
   * @returns
   * @memberof Container
   */
  public getIdentifier(target: Function | object): string {
    if (helper.isFunction(target)) {
      const metaData = Reflect.getOwnMetadata(TAGGED_CLS, target);
      return metaData ? metaData.id ?? "" : target.name ?? "";
    }
    return target.constructor ? target.constructor.name ?? "" : "";
  }

  /**
   * get component type from class
   *
   * @param {Function} target
   * @returns
   * @memberof Container
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
   * save class to Container
   *
   * @param {ComponentType} type
   * @param {Function} module
   * @param {string} identifier
   * @memberof Container
   */
  public saveClass(type: ComponentType, module: Function, identifier: string) {
    Reflect.defineMetadata(TAGGED_CLS, { id: identifier, type }, module);
    const key = `${type}:${identifier}`;
    if (!this.classMap.has(key)) {
      this.classMap.set(key, module);
    }
  }

  /**
   * get all class from Container
   *
   * @param {ComponentType} type
   * @returns
   * @memberof Container
   */
  public listClass(type: ComponentType) {
    return Array.from(this.classMap.entries())
      .filter(([k]) => k.startsWith(type))
      .map(([k, v]) => ({ id: k, target: v }));
  }

  /**
   * save meta data to class or property
   *
   * @param {string} type
   * @param {(string | symbol)} decoratorNameKey
   * @param {*} data
   * @param {(Function | object)} target
   * @param {string} [propertyName]
   * @memberof Container
   */
  public saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    originMap.set(decoratorNameKey, data);
  }

  /**
   * attach data to class or property
   *
   * @param {string} type
   * @param {(string | symbol)} decoratorNameKey
   * @param {*} data
   * @param {(Function | object)} target
   * @param {string} [propertyName]
   * @memberof Container
   */
  public attachClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    if (!originMap.has(decoratorNameKey)) {
      originMap.set(decoratorNameKey, []);
    }
    originMap.get(decoratorNameKey).push(data);
  }

  /**
   * get single data from class or property
   *
   * @param {string} type
   * @param {(string | symbol)} decoratorNameKey
   * @param {(Function | object)} target
   * @param {string} [propertyName]
   * @returns
   * @memberof Container
   */
  public getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object, propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    return originMap.get(decoratorNameKey);
  }

  /**
   * save property data to class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {*} data
   * @param {(Function | object)} target
   * @param {(string | symbol)} propertyName
   * @memberof Container
   */
  public savePropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    originMap.set(propertyName, data);
  }

  /**
   * attach property data to class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {*} data
   * @param {(Function | object)} target
   * @param {(string | symbol)} propertyName
   * @memberof Container
   */
  public attachPropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    if (!originMap.has(propertyName)) {
      originMap.set(propertyName, []);
    }
    originMap.get(propertyName).push(data);
  }

  /**
   * get property data from class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {(Function | object)} target
   * @param {(string | symbol)} propertyName
   * @returns
   * @memberof Container
   */
  public getPropertyData(decoratorNameKey: string | symbol, target: Function | object, propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    return originMap.get(propertyName);
  }

  /**
   * list property data from class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {(Function | object)} target
   * @returns
   * @memberof Container
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
 * export Singleton.
 * get the singleton instance of Container
 */
export const IOC: Container = (function () {
  if (!helper.isTrueEmpty(process.env.KOATTY_CONTAINER)) {
    throw Error("There are two different versions of the koatty_container module that are conflicting.");
  }
  process.env.KOATTY_CONTAINER = "true";
  return Container.getInstance();
})();

/**
 * alias IOC
 */
export const IOCContainer = IOC;
