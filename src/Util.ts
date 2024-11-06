/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import { IOC } from "./Container";
import { AOPType, IAspect, IContainer, ObjectDefinitionOptions, TAGGED_AOP, TAGGED_ARGS, TAGGED_CLS, TAGGED_PROP } from "./IContainer";

// get property of an object
const functionPrototype = Object.getPrototypeOf(Function);
// https://tc39.github.io/ecma262/#sec-ordinarygetprototypeof
function ordinaryGetPrototypeOf(obj: any): any {
  const proto = Object.getPrototypeOf(obj);
  if (typeof obj !== "function" || obj === functionPrototype) {
    return proto;
  }

  // TypeScript doesn't set __proto__ in ES5, as it's non-standard.
  // Try to determine the superclass constructor. Compatible implementations
  // must either set __proto__ on a subclass constructor to the superclass constructor,
  // or ensure each class has a valid `constructor` property on its prototype that
  // points back to the constructor.

  // If this is not the same as Function.[[Prototype]], then this is definitely inherited.
  // This is the case when in ES6 or when using __proto__ in a compatible browser.
  if (proto !== functionPrototype) {
    return proto;
  }

  // If the super prototype is Object.prototype, null, or undefined, then we cannot determine the heritage.
  const prototype = obj.prototype;
  const prototypeProto = prototype && Object.getPrototypeOf(prototype);
  // tslint:disable-next-line: triple-equals
  if (prototypeProto == undefined || prototypeProto === Object.prototype) {
    return proto;
  }

  // If the constructor was not a function, then we cannot determine the heritage.
  const constructor = prototypeProto.constructor;
  if (typeof constructor !== "function") {
    return proto;
  }

  // If we have some kind of self-reference, then we cannot determine the heritage.
  if (constructor === obj) {
    return proto;
  }

  // we have a pretty good guess at the heritage.
  return constructor;
}
/**
 * get metadata value of a metadata key on the prototype chain of an object and property
 * @param metadataKey metadata key
 * @param target the target of metadataKey
 */
export function RecursiveGetMetadata(metadataKey: any, target: any, _propertyKey?: string | symbol): any[] {
  // get metadata value of a metadata key on the prototype
  // let metadata = Reflect.getOwnMetadata(metadataKey, target, propertyKey);
  const metadata = IOC.listPropertyData(metadataKey, target) ?? {};
  // get metadata value of a metadata key on the prototype chain
  let parent = ordinaryGetPrototypeOf(target);
  while (parent !== null) {
    // metadata = Reflect.getOwnMetadata(metadataKey, parent, propertyKey);
    const parentMetadata = IOC.listPropertyData(metadataKey, parent);
    if (parentMetadata) {
      mergeMetadata(parentMetadata, metadata);
    }
    parent = ordinaryGetPrototypeOf(parent);
  }
  return metadata;
}

/**
 * Merge object properties and override the source object when
 *  the property values in the new object are not undefined.
 * @param parentMetadata source object metadata
 * @param metadata object metadata
 * @returns 
 */
function mergeMetadata(parentMetadata: Record<string, any>, metadata: Record<string, any>): Record<string, any> {
  // Create a copy to store the final results, initialized with the parent class's metadata.
  const result = { ...parentMetadata };

  // Iterate through all keys in the metadata object.
  for (const key in metadata) {
    if (metadata.hasOwnProperty(key)) {
      // Skip assignment if an item in the metadata is undefined.
      if (metadata[key] !== undefined) {
        result[key] = metadata[key];
      }
    }
  }

  return result;
}

/**
 * Override object's property to PrototypeValue
 * @param instance 
 */
export function OverridePrototypeValue<T extends object>(instance: T): void {
  if (!instance || typeof instance !== 'object') {
    throw new Error("Invalid instance provided.");
  }
  // get object properties
  for (const propertyName in instance) {
    // check property is undefined
    if (instance[propertyName] === undefined) {
      const protoValue = Object.getPrototypeOf(instance)[propertyName];
      if (protoValue !== undefined) {
        instance[propertyName] = protoValue;
      }
    }
  }

}

/**
*
*
* @param {(string | symbol)} metadataKey
* @param {*} target
* @param {(string | symbol)} [propertyKey]
* @returns
*/
export function getOriginMetadata(metadataKey: string | symbol, target: any, propertyKey?: string | symbol) {
  // filter Object.create(null)
  if (typeof target === "object" && target.constructor) {
    target = target.constructor;
  }
  if (propertyKey) {
    // for property or method
    if (!Reflect.hasMetadata(metadataKey, target, propertyKey)) {
      Reflect.defineMetadata(metadataKey, new Map(), target, propertyKey);
    }
    return Reflect.getMetadata(metadataKey, target, propertyKey);
  } else {
    // for class
    if (!Reflect.hasMetadata(metadataKey, target)) {
      Reflect.defineMetadata(metadataKey, new Map(), target);
    }
    return Reflect.getMetadata(metadataKey, target);
  }
}

/**
 * Find all methods on a given ES6 class
 *
 * @param {*} target 
 * @param {boolean} isSelfProperties 
 * @returns {string[]}
 */
export function getMethodNames(target: any, isSelfProperties = false): string[] {
  const result: Set<string> = new Set();
  const enumerableOwnKeys = Object.getOwnPropertyNames(target.prototype);
  if (!isSelfProperties) {
    // searching prototype chain for methods
    let parent = ordinaryGetPrototypeOf(target);
    while (helper.isClass(parent) && parent.constructor) {
      const allOwnKeysOnPrototype = Object.getOwnPropertyNames(parent.prototype);
      // get methods from es6 class
      allOwnKeysOnPrototype.forEach((k) => {
        if (helper.isFunction(parent.prototype[k])) {
          result.add(k);
        }
      });
      parent = ordinaryGetPrototypeOf(parent);
    }
  }

  // leave out those methods on Object's prototype
  enumerableOwnKeys.forEach((k) => {
    if (helper.isFunction(target.prototype[k])) {
      result.add(k);
    }
  });
  return Array.from(result);
}

/**
 * Find all property on a given ES6 class 
 *
 * @export
 * @param {*} target
 * @param {boolean} isSelfProperties 
 * @returns {string[]}
 */
export function getPropertyNames(target: any, isSelfProperties = false): string[] {
  const result: Set<string> = new Set();
  const enumerableOwnKeys = Object.getOwnPropertyNames(target);
  if (!isSelfProperties) {
    // searching prototype chain for methods
    let parent = ordinaryGetPrototypeOf(target);
    while (helper.isClass(parent) && parent.constructor) {
      const allOwnKeysOnPrototype = Object.getOwnPropertyNames(parent);
      // get methods from es6 class
      allOwnKeysOnPrototype.forEach((k) => {
        if (!helper.isFunction(parent.prototype[k])) {
          result.add(k);
        }
      });
      parent = ordinaryGetPrototypeOf(parent);
    }
  }

  // leave out those methods on Object's prototype
  enumerableOwnKeys.forEach((k) => {
    if (!helper.isFunction(target.prototype[k])) {
      result.add(k);
    }
  });
  return Array.from(result);
}

/**
 * inject AOP
 *
 * @export
 * @param {Function} target
 * @param {*} instance
 * @param {Container} container
 * @param {ObjectDefinitionOptions} _options
 */
export function injectAOP(target: Function, prototypeChain: unknown, container: IContainer, _options?: ObjectDefinitionOptions) {
  const allMethods = getMethodNames(target);
  // only binding self method
  const selfMethods = getMethodNames(target, true);
  const methodsFilter = (ms: string[]) => ms.filter((m: string) => !['constructor', 'init', '__before', '__after'].includes(m));
  let hasDefaultBefore = false, hasDefaultAfter = false;
  if (allMethods.includes('__before')) {
    // inject default AOP method
    injectDefaultAOP(target, prototypeChain, methodsFilter(selfMethods));
    hasDefaultBefore = true;
  }
  if (allMethods.includes('__after')) {
    // inject default AOP method
    injectDefaultAOP(target, prototypeChain, methodsFilter(selfMethods));
    hasDefaultAfter = true;
  }

  const classMetaDatas: any[] = container.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) ?? [];
  // eslint-disable-next-line prefer-const
  for (let { type, name, method } of classMetaDatas) {
    if (name && [AOPType.Before, AOPType.BeforeEach, AOPType.After, AOPType.AfterEach].includes(type)) {
      methodsFilter(selfMethods).forEach((element: string) => {
        // If the class has defined the default AOP method,
        // @BeforeEach and @AfterEach will not take effect
        if (type === AOPType.BeforeEach) {
          if (hasDefaultBefore) {
            return;
          }
          method = element;
        }
        if (type === AOPType.AfterEach) {
          if (hasDefaultAfter) {
            return;
          }
          method = element;
        }
        if (element === method) {
          logger.Debug(`Register inject AOP ${target.name} method: ${element} => ${type}`);
          defineAOPProperty(target, element, name, type);
        }
      });
    }
  }
}

/**
 * Determine whether the class contains the default AOP method
 *
 * @param {*} target
 * @returns {*}  {boolean}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hasDefaultAOP(target: any): boolean {
  const allMethods = getMethodNames(target).filter((m: string) =>
    !["constructor", "init"].includes(m)
  );
  // class contains the default AOP method
  if (allMethods.includes("__before") || allMethods.includes("__after")) {
    return true;
  }
  return false;
}

/**
 * inject default AOP
 *
 * @export
 * @param {Function} target
 * @param {object} prototypeChain
 * @param {string[]} methods
 * @returns {*}
 */
function injectDefaultAOP(target: Function, prototypeChain: any, methods: string[]) {
  methods.forEach((element) => {
    if (helper.isFunction(prototypeChain.__before)) {
      logger.Debug(`The ${target.name} class has AOP method '__before', @BeforeEach is not take effect`);
      logger.Debug(`Register inject default AOP ${target.name} method: ${element} => __before`);
      defineAOPProperty(target, element, "__before", AOPType.BeforeEach);
    }
    if (helper.isFunction(prototypeChain.__after)) {
      logger.Debug(`The ${target.name} class has AOP method '__after', @AfterEach is not take effect`);
      logger.Debug(`Register inject default AOP ${target.name} method: ${element} => __after`);
      defineAOPProperty(target, element, "__after", AOPType.AfterEach);
    }
  });
}

/**
 * Dynamically add methods for target class types
 *
 * @param {Function} classes
 * @param {string} protoName
 * @param {(string | Function)} aopName
 */
function defineAOPProperty(classes: Function, protoName: string, aopName: string, type: AOPType) {
  const oldMethod = Reflect.get(classes.prototype, protoName);
  if (!oldMethod) throw Error(`${protoName} method does not exist.`);
  Reflect.defineProperty(classes.prototype, protoName, {
    writable: true,
    async value(...props: any[]) {
      if ([AOPType.Before, AOPType.BeforeEach].includes(type)) {
        logger.Debug(`Execute the before aspect ${classes.name} ${aopName}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        aopName === "__before" ? await Reflect.apply(this.__before, this, props) : await executeAspect(aopName, props);
      }
      const res = await Reflect.apply(oldMethod, this, props);
      if ([AOPType.After, AOPType.AfterEach].includes(type)) {
        logger.Debug(`Execute the after aspect ${classes.name} ${aopName}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        aopName === "__after" ? await Reflect.apply(this.__after, this, props) : await executeAspect(aopName, props);
      }
      return res;
    }
  });
}

/**
 * Execute aspect
 *
 * @param {string} aopName
 * @param {any[]} props
 * @returns {*}  
 */
async function executeAspect(aopName: string, props: any[]) {
  const aspect: IAspect = IOC.get(aopName, "COMPONENT");
  if (!aspect || !helper.isFunction(aspect.run))
    throw Error(`Failed to obtain slice class ${aopName} instance`);
  return aspect.run(...props);
}


/**
 * inject autowired class
 *
 * @export
 * @param {Function} target
 * @param {object} instance
 * @param {Container} container
 * @param {ObjectDefinitionOptions} options
 * @param {boolean} [isLazy=false]
 */
export function injectAutowired(target: Function, prototypeChain: object, container: IContainer,
  options?: ObjectDefinitionOptions, isLazy = false) {
  const metaData = RecursiveGetMetadata(TAGGED_PROP, target);
  for (const metaKey in metaData) {
    const { type, identifier, delay, args } =
      metaData[metaKey] || { type: "", identifier: "", delay: false, args: [] };
    isLazy = isLazy || delay;
    if (type && identifier) {
      const dep = container.get(identifier, type, args);
      if (!dep) {
        if (!isLazy) {
          throw new Error(
            `Component ${metaData[metaKey].identifier ?? ""} not found. It's inject in class ${target.name}`);
        }
        isLazy = true;
      }

      if (isLazy) {
        // Delay loading solves the problem of cyclic dependency
        logger.Debug(`Delay loading solves the problem of cyclic dependency(${identifier})`);
        // lazy loading used event emit
        options.isAsync = true;
        const app = container.getApp();
        // lazy inject autowired
        if (app?.once) {
          app.once("appReady", () => injectAutowired(target, prototypeChain, container, options, true));
        }
      } else {
        logger.Debug(
          `Register inject ${target.name} properties key: ${metaKey} => value: ${JSON.stringify(metaData[metaKey])}`);
        Reflect.defineProperty(prototypeChain, metaKey, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: dep
        });
      }
    }
  }
}

/**
 * Inject class instance property
 * @param target 
 * @param instance 
 * @param _container 
 * @param _options 
 */
export function injectValues(target: Function, instance: object, _container?: IContainer, _options?: ObjectDefinitionOptions) {
  const metaData = RecursiveGetMetadata(TAGGED_ARGS, target);
  for (const { name, method } of Object.values(metaData)) {
    logger.Debug(`Register inject ${name} properties => value: ${JSON.stringify(metaData[name])}`);
    let targetValue = method;
    if (helper.isFunction(method)) {
      targetValue = method();
    }
    Reflect.defineProperty(instance, name, {
      enumerable: true,
      configurable: false,
      writable: true,
      value: targetValue,
    });
  }
}
