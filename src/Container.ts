/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
// tslint:disable-next-line: no-import-side-effect
import * as helper from "koatty_lib";
import "reflect-metadata";
import { injectAOP } from "./AOP";
import { injectAutowired } from './Autowired';
import {
  Application,
  ComponentType, IContainer,
  ObjectDefinitionOptions, TAGGED_CLS
} from "./IContainer";
import { OverridePrototypeValue } from "./Util";
import { injectValues } from "./Values";

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
   * @returns {T}
   * @memberof Container
   */
  public reg<T extends object | Function>(identifier: string | T, target?: T | ObjectDefinitionOptions,
    options?: ObjectDefinitionOptions): T {
    if (helper.isString(identifier)) {
      identifier = identifier;
      if (target !== undefined) {
        target = target as T;
      }
    } else {
      if (options && helper.isObject(options)) {
        options = target as ObjectDefinitionOptions;
      }
      target = identifier as T;
      identifier = this.getIdentifier(target);
    }

    if (!helper.isClass(target)) {
      throw new Error("target is not a class");
    }

    let instance = this.instanceMap.get(target);
    if (!instance) {
      options = {
        isAsync: false,
        initMethod: "constructor",
        destroyMethod: "destructor",
        scope: "Singleton",
        type: "COMPONENT",
        args: [],
        ...options
      };
      // inject options once
      Reflect.defineProperty((<Function>target).prototype, "_options", {
        enumerable: false,
        configurable: false,
        writable: true,
        value: options
      });

      // define app as getter
      Reflect.defineProperty((<Function>target).prototype, "app", {
        get: () => this.app,
        configurable: false,
        enumerable: false
      });

      // inject autowired
      injectAutowired(<Function>target, (<Function>target).prototype, this);
      // inject properties values
      injectValues(target, (<Function>target).prototype, this);
      // inject AOP
      injectAOP(<Function>target, (<Function>target).prototype, this);

      if (!this.getClass(<string>identifier, options.type)) {
        this.saveClass(options.type, <Function>target, <string>identifier);
      }

      // instantiation
      instance = Reflect.construct(<Function>target, options.args);
      OverridePrototypeValue(instance);

      if (options.scope === "Singleton") {
        instance = Object.seal(instance);
      }
      // registration
      this.instanceMap.set(target, instance);
    }
    return instance;
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
  public get(identifier: string, type: ComponentType = "COMPONENT", args: any[] = []): any {
    const target = this.getClass(identifier, type);
    if (!target) {
      return null;
    }
    // get instance from the Container
    const instance: any = this.instanceMap.get(target);
    // require Prototype instance
    if (args.length > 0) {
      // instantiation
      return Reflect.construct(target, args);
    } else {
      return instance;
    }
  }

  /**
   * get class from IOC container by identifier.
   *
   * @param {string} identifier
   * @param {ComponentType} [type="SERVICE"]
   * @returns {Function}
   * @memberof Container
   */
  public getClass(identifier: string, type: ComponentType = "SERVICE"): Function {
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
    const name = (<Function>target).name || (target.constructor ? target.constructor.name : "");
    return name.includes("Controller") ? "CONTROLLER" :
      name.includes("Middleware") ? "MIDDLEWARE" :
        name.includes("Service") ? "SERVICE" :
          "COMPONENT";
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