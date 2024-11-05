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
    if (!Reflect.has(target.prototype, "run")) {
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
  if (!aopName) throw Error("AopName is required.");
  return (target: any, methodName: string, _descriptor: PropertyDescriptor) => {
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
  if (!aopName) throw Error("AopName is required.");
  return (target: any, methodName: symbol | string, _descriptor: PropertyDescriptor) => {
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
  let hasDefaultBefore = false, hasDefaultAfter = false;
  if (allMethods.includes('__before')) {
    // inject default AOP method
    injectDefaultAOP(target, instance, methodsFilter(selfMethods));
    hasDefaultBefore = true;
  }
  if (allMethods.includes('__after')) {
    // inject default AOP method
    injectDefaultAOP(target, instance, methodsFilter(selfMethods));
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
 * @param {*} instance
 * @param {string[]} methods
 * @returns {*}
 */
function injectDefaultAOP(target: Function, instance: any, methods: string[]) {
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
  const aspect = IOCContainer.get(aopName, "COMPONENT");
  if (aspect && helper.isFunction(aspect.run)) {
    await aspect.run(...props);
  }
  return Promise.resolve();
}
