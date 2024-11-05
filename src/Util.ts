/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
import * as helper from "koatty_lib";
import { IOC } from "./Container";

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

  // get object own properties
  const ownProperties = Object.keys(instance);

  let prototype = Object.getPrototypeOf(instance);
  while (prototype !== null) {
    Object.keys(prototype).forEach(propertyName => {
      // check property is defined
      if (!ownProperties.includes(propertyName) ||
        (instance as any)[propertyName] === undefined) {
        // override property's value
        (instance as any)[propertyName] = (prototype as any)[propertyName];
      }
    });
    // move to next
    prototype = Object.getPrototypeOf(prototype);
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

