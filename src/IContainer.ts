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

// used to store router 
export const CONTROLLER_ROUTER = "CONTROLLER_ROUTER";

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
 * Aspect interface
 *
 * @export
 * @interface IAspect
 */
export interface IAspect {
  app: Application;

  run: (...args: any[]) => Promise<any>;
}

/**
 * Defined constructor interface
 */
export interface Constructor<T> {
  new(...args: any[]): T;
}



/**
 * Base Application interface
 *
 * @export
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
 * Base Context interface
 *
 * @export
 * @interface Context
 * @extends {Koa.Context}
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
 * Container interface
 *
 * @export
 * @interface IContainer
 */
export interface IContainer {
  /**
     * set app
     *
     * @param {Koatty} app
     * @returns
     * @memberof Container
     */
  setApp(app: Application): void;
  /**
   * get app
   *
   * @returns
   * @memberof Container
   */
  getApp(): Application;
  /**
   * registering an instance of a class to an IOC container.
   *
   * @template T
   * @param {T} target
   * @param {ObjectDefinitionOptions} [options]
   * @returns {void}
   * @memberof Container
   */
  reg<T extends object | Function>(identifier: string | T, target?: T | ObjectDefinitionOptions, options?: ObjectDefinitionOptions): void;

  /**
   * get an instance from the IOC container.
   *
   * @template T
   * @param {string | Constructor<T>} identifier
   * @param {ComponentType} [type="COMPONENT"]
   * @param {...any[]} args
   * @returns {T}
   */
  get<T>(identifier: string | Constructor<T>, type?: ComponentType, ...args: any[]): T;
  /**
   * get class from IOC container by identifier.
   *
   * @param {string} identifier
   * @param {ComponentType} [type="COMPONENT"]
   * @returns {Function}
   * @memberof Container
   */
  getClass(identifier: string, type?: ComponentType): Function;
  /**
   * get instance from IOC container by class.
   *
   * @template T
   * @param {T} target
   * @param {any[]} [args=[]]
   * @returns {T}
   * @memberof Container
   */
  getInsByClass<T extends object | Function>(target: T, args?: any[]): T;
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
  getMetadataMap(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol): any;
  /**
   * get identifier from class
   *
   * @param {Function | Object} target
   * @returns
   * @memberof Container
   */
  getIdentifier(target: Function | object): string;
  /**
   * get component type from class
   *
   * @param {Function} target
   * @returns
   * @memberof Container
   */
  getType(target: Function | object): any;
  /**
   * save class to Container
   *
   * @param {ComponentType} type
   * @param {Function} module
   * @param {string} identifier
   * @memberof Container
   */
  saveClass(type: ComponentType, module: Function, identifier: string): void;
  /**
   * get all class from Container
   *
   * @param {ComponentType} type
   * @returns
   * @memberof Container
   */
  listClass(type: ComponentType): {
    id: string;
    target: Function;
  }[];
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
  saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string): void;
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
  attachClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string): void;
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
  getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object, propertyName?: string): any;
  /**
   * save property data to class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {*} data
   * @param {(Function | object)} target
   * @param {(string | symbol)} propertyName
   * @memberof Container
   */
  savePropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol): void;
  /**
   * attach property data to class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {*} data
   * @param {(Function | object)} target
   * @param {(string | symbol)} propertyName
   * @memberof Container
   */
  attachPropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol): void;
  /**
   * get property data from class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {(Function | object)} target
   * @param {(string | symbol)} propertyName
   * @returns
   * @memberof Container
   */
  getPropertyData(decoratorNameKey: string | symbol, target: Function | object, propertyName: string | symbol): any;
  /**
   * list property data from class
   *
   * @param {(string | symbol)} decoratorNameKey
   * @param {(Function | object)} target
   * @returns
   * @memberof Container
   */
  listPropertyData(decoratorNameKey: string | symbol, target: Function | object): any;
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
  type: ComponentType;
  args: any[];
}

/**
 *
 *
 * @export
 * @interface TagClsMetadata
 */
export interface TagClsMetadata {
  id: string;
  originName: string;
}

/**
 *
 *
 * @export
 * @interface TagPropsMetadata
 */
export interface TagPropsMetadata {
  key: string | number | symbol;
  value: any;
}

/**
 *
 *
 * @export
 * @interface ReflectResult
 */
export interface ReflectResult {
  [key: string]: TagPropsMetadata[];
}

/**
 * Interface for Controller
 */
export interface IController {
  readonly app: Application;
  readonly ctx: Context;
}

/**
 * Interface for Middleware
 */
export interface IMiddleware {
  run: (options: object, app: Application) => (ctx: object, next: Function) => Promise<any>;
}

/**
 * Interface for Service
 */
export interface IService {
  readonly app: Application;

  // init(...arg: any[]): void;
}
