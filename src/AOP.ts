/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { IOC } from "./Container";
import { AOPType, TAGGED_AOP, TAGGED_CLS } from "./IContainer";


/**
 * Indicates that an decorated class is a "aspect".
 *
 * @export
 * @param {string} [identifier]
 * @returns {ClassDecorator}
 */
export function Aspect(identifier?: string): ClassDecorator {
  return (target: Function) => {
    identifier = identifier || IOC.getIdentifier(target);
    if (!identifier.endsWith("Aspect")) {
      throw Error("Aspect class names must use a suffix `Aspect`.");
    }
    if (!Reflect.has(target.prototype, "run")) {
      throw Error("The aspect class must implement the `run` method.");
    }
    IOC.saveClass("COMPONENT", target, identifier);
  };
}

/**
 * Executed before specifying the PointCut method.
 *
 * @export
 * @param {string} aopName
 * @returns {MethodDecorator}
 */
export function Before(aopName: string): MethodDecorator {
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: string, _descriptor: PropertyDescriptor) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.Before,
      name: aopName,
      method: methodName,
    }, target);
  };
}

/**
 * Executed after execution of each method of the specified PointCut class.
 *
 * @export
 * @param {string} [aopName]
 * @returns {Function}
 */
export function BeforeEach(aopName: string): ClassDecorator {
  return (target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.BeforeEach,
      name: aopName
    }, target);
  };
}

/**
 * Executed after specifying the PointCut method.
 *
 * @export
 * @param {string} aopName
 * @returns {MethodDecorator}
 */
export function After(aopName: string): MethodDecorator {
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: symbol | string, _descriptor: PropertyDescriptor) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.After,
      name: aopName,
      method: methodName,
    }, target);
  };
}

/**
 * Executed after execution of each method of the specified PointCut class.
 *
 * @export
 * @param {string} aopName
 * @returns {Function}
 */
export function AfterEach(aopName: string): ClassDecorator {
  return (target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AfterEach,
      name: aopName
    }, target);
  };
}

