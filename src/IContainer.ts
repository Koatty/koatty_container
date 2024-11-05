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

/**
 * Base Application
 *
 * @export
 * @interface Application
 */
export interface Application {
  env: string;
  options: any;

  use: (fn: Function) => any;
  config: (name: string, type?: string) => any;
  on(event: string, callback: () => void): any;
  once(event: string, callback: () => void): any;
  /**
  * app metadata
  *
  * @memberof Application
  */
  getMetaData: (key: string) => any;
  setMetaData: (key: string, value: unknown) => void;
}
/**
 * Base Context.
 *
 * @export
 * @interface Context
 * @extends {Koa.Context}
 */
export interface Context {
  /**
   * Replace ctx.throw
   *
   * @type {(status: number, message?: string)}
   * @type {(message: string, code?: number, status?: HttpStatusCode)}
   * @memberof Context
   */
  throw(status: number, message?: string): never;
  throw(message: string, code?: number, status?: any): never;
  /**
  * context metadata
  *
  * @memberof Context
  */
  getMetaData: (key: string) => any;
  setMetaData: (key: string, value: unknown) => void;
}

/**
 * Container interface
 *
 * @export
 * @interface IContainer
 */
export interface IContainer {
  setApp(app: Application): void;
  reg<T extends object | Function>(target: T, options?: ObjectDefinitionOptions): T;
  reg<T extends object | Function>(identifier: string, target: T, options?: ObjectDefinitionOptions): T;
  reg<T extends object | Function>(identifier: any, target?: any, options?: ObjectDefinitionOptions): T;
  get(identifier: string, type?: ComponentType, args?: any[]): any;
  getClass(identifier: string, type?: ComponentType): Function;
  getInsByClass<T extends object | Function>(target: T, args?: any[]): T;
  saveClass(type: ComponentType, module: Function, identifier: string): void;
  listClass(type: ComponentType): any[];
  getIdentifier(target: Function | object): string;
  getType(target: Function | object): string;
  getMetadataMap(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol): any;
  saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string): void;
  attachClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName?: string): void;
  getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object, propertyName?: string): any;
  savePropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol): void;
  attachPropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object, propertyName: string | symbol): void;
  getPropertyData(decoratorNameKey: string | symbol, target: Function | object, propertyName: string | symbol): any;
  listPropertyData(decoratorNameKey: string | symbol, target: Function | object): any[];
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
