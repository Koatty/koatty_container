/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import { Container, IOCContainer } from "./Container";
import { TAGGED_AOP, TAGGED_CLS } from "./IContainer";
import { getMethodNames } from "./Util";

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
  app: any;

  run: (...args: any[]) => Promise<any>;
}

/**
 * Indicates that an decorated class is a "aspect".
 *
 * @export
 * @param {string} [identifier]
 * @returns {ClassDecorator}
 */
export function Aspect(identifier?: string): ClassDecorator {
  return (target: any) => {
    identifier = identifier || IOCContainer.getIdentifier(target);
    if (!identifier.endsWith("Aspect")) {
      throw Error("Aspect class names must use a suffix `Aspect`.");
    }
    const oldMethod = Reflect.get(target.prototype, "run");
    if (!oldMethod) {
      throw Error("The aspect class must implement the `run` method.");
    }
    IOCContainer.saveClass("COMPONENT", target, identifier);
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
  return (target: any, methodName: string, descriptor: PropertyDescriptor) => {
    if (!aopName) {
      throw Error("AopName is required.");
    }
    // const { value, configurable, enumerable } = descriptor;
    // descriptor = {
    //     configurable,
    //     enumerable,
    //     writable: true,
    //     async value(...props: any[]) {
    //         await executeAspect(aopName, props);
    //         // tslint:disable-next-line: no-invalid-this
    //         return value.apply(this, props);
    //     },
    // };
    // return descriptor;
    IOCContainer.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
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
  return (target: any) => {
    IOCContainer.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
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
  return (target: any, methodName: symbol | string, descriptor: PropertyDescriptor) => {
    if (!aopName) {
      throw Error("AopName is required.");
    }
    // const { value, configurable, enumerable } = descriptor;
    // descriptor = {
    //     configurable,
    //     enumerable,
    //     writable: true,
    //     async value(...props: any[]) {
    //         // tslint:disable-next-line: no-invalid-this
    //         const res = await value.apply(this, props);
    //         await executeAspect(aopName, props);
    //         return res;
    //     }
    // };
    // return descriptor;
    IOCContainer.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
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
  return (target: any) => {
    IOCContainer.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AfterEach,
      name: aopName
    }, target);
  };
}

/**
 * inject AOP
 *
 * @export
 * @param {Function} target
 * @param {*} instance
 * @param {Container} container
 */
export function injectAOP(target: Function, instance: unknown, container: Container) {
  const allMethods = getMethodNames(target);
  // only binding self method
  const selfMethods = getMethodNames(target, true);
  const methodsFilter = (ms: string[]) => ms.filter((m: string) => !['constructor', 'init', '__before', '__after'].includes(m));
  let hasDefault = false;
  if (allMethods.includes('__before') || allMethods.includes('__after')) {
    // inject default AOP method
    injectDefaultAOP(target, instance, methodsFilter(selfMethods));
    hasDefault = true;
  }

  const classMetaDatas: any[] = container.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) ?? [];
  for (const classMetaData of classMetaDatas) {
    // eslint-disable-next-line prefer-const
    let { type, name, method } = classMetaData || {};
    if (name && [AOPType.Before, AOPType.BeforeEach, AOPType.After, AOPType.AfterEach].includes(type)) {
      methodsFilter(selfMethods).forEach((element: string) => {
        if ([AOPType.BeforeEach, AOPType.AfterEach].includes(type)) {
          method = element;
        }
        if (element === method) {
          // If the class has defined the default AOP method, @BeforeEach and @AfterEach will not take effect
          if (hasDefault && (type === AOPType.BeforeEach || type === AOPType.AfterEach)) {
            return;
          }
          // Logger.Debug(`Register inject AOP ${target.name} method: ${element} => ${type}`);
          defineAOPProperty(target, element, name, type);
        }
      });
    }
  }
}

// /**
//  * Determine whether the class contains the default AOP method
//  *
//  * @param {*} target
//  * @returns {*}  {boolean}
//  */
// function hasDefaultAOP(target: any): boolean {
//     const allMethods = getMethodNames(target).filter((m: string) =>
//         !["constructor", "init"].includes(m)
//     );
//     // class contains the default AOP method
//     if (allMethods.includes("__before") || allMethods.includes("__after")) {
//         return true;
//     }
//     return false;
// }

/**
 * inject default AOP
 *
 * @export
 * @param {Function} target
 * @param {*} instance
 * @param {string[]} methods
 * @returns {*}
 */
function injectDefaultAOP(target: Function, instance: any, methods: string[]) {
  // class methods
  // const methods = getMethodNames(target, true).filter((m: string) =>
  //     !["constructor", "init", "__before", "__after"].includes(m)
  // );
  methods.forEach((element) => {
    if (helper.isFunction(instance.__before)) {
      logger.Debug(`The ${target.name} class has AOP method '__before', @BeforeEach is not take effect`);
      logger.Debug(`Register inject default AOP ${target.name} method: ${element} => __before`);
      defineAOPProperty(target, element, "__before", AOPType.BeforeEach);
    }
    if (helper.isFunction(instance.__after)) {
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
  if (oldMethod) {
    Reflect.defineProperty(classes.prototype, protoName, {
      writable: true,
      async value(...props: any[]) {
        if ([AOPType.Before, AOPType.BeforeEach].includes(type)) {
          if (aopName === "__before") {
            logger.Debug(`Execute the aspect ${classes.name}.__before`);
            // tslint:disable-next-line: no-invalid-this
            await Reflect.apply(this.__before, this, props);
          } else {
            await executeAspect(aopName, props);
          }
          // tslint:disable-next-line: no-invalid-this
          return Reflect.apply(oldMethod, this, props);
        } else {
          // tslint:disable-next-line: no-invalid-this
          const res = await Reflect.apply(oldMethod, this, props);
          if (aopName === "__after") {
            logger.Debug(`Execute the aspect ${classes.name}.__after`);
            // tslint:disable-next-line: no-invalid-this
            await Reflect.apply(this.__after, this, props);
          } else {
            await executeAspect(aopName, props);
          }
          return res;
        }
      }
    });
  } else {
    throw Error(`${protoName} method does not exist.`);
  }
}

/**
 * Execute aspect
 *
 * @param {string} aopName
 * @param {any[]} props
 * @returns {*}  
 */
async function executeAspect(aopName: string, props: any[]) {
  // tslint:disable-next-line: one-variable-per-declaration
  const aspect = IOCContainer.get(aopName, "COMPONENT");
  if (aspect && helper.isFunction(aspect.run)) {
    logger.Debug(`Execute the aspect ${aopName}`);
    // tslint:disable-next-line: no-invalid-this
    await aspect.run(...props);
  }
  return Promise.resolve();
}

