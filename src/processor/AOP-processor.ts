/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-02-26 17:07:01
 * @LastEditTime: 2025-02-26 17:37:07
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import {
  AOPType, IAspect, IContainer, ObjectDefinitionOptions,
  TAGGED_AOP, TAGGED_CLS
} from "../container/IContainer";
import { getMethodNames } from "../utils/Util";

/**
 * inject AOP
 *
 * @export
 * @param {Function} target
 * @param {*} instance
 * @param {Container} container
 * @param {ObjectDefinitionOptions} _options
 */
export function injectAOP(target: Function, prototypeChain: unknown,
  container: IContainer, _options?: ObjectDefinitionOptions) {
  const allMethods = getMethodNames(target);
  // only binding self method
  const selfMethods = getMethodNames(target, true);
  const methodsFilter = (ms: string[]) => ms.filter((m: string) => !['constructor', 'init',
    '__before', '__after'].includes(m));
  let hasDefaultBefore = false, hasDefaultAfter = false;
  if (allMethods.includes('__before')) {
    // inject default AOP method
    injectDefaultAOP(container, target, prototypeChain, methodsFilter(selfMethods));
    hasDefaultBefore = true;
  }
  if (allMethods.includes('__after')) {
    // inject default AOP method
    injectDefaultAOP(container, target, prototypeChain, methodsFilter(selfMethods));
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
          defineAOPProperty(container, target, prototypeChain, element, name, type);
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
 * Dynamically add methods for target class types
 * @param container 
 * @param classes 
 * @param prototypeChain 
 * @param protoName 
 * @param aopName 
 * @param type 
 */
function defineAOPProperty(container: IContainer, classes: Function, prototypeChain: any,
  protoName: string, aopName: string, type: AOPType) {
  const oldMethod = Reflect.get(prototypeChain, protoName);
  if (!oldMethod) throw Error(`${protoName} method does not exist.`);
  Reflect.defineProperty(prototypeChain, protoName, {
    enumerable: true,
    configurable: false,
    writable: true,
    async value(...props: any[]) {
      if ([AOPType.Before, AOPType.BeforeEach].includes(type)) {
        logger.Debug(`Execute the before aspect ${classes.name} ${aopName}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        aopName === "__before" ? await Reflect.apply(this.__before, this, props) :
          await executeAspect(container, aopName, props);
      }
      const res = await Reflect.apply(oldMethod, this, props);
      if ([AOPType.After, AOPType.AfterEach].includes(type)) {
        logger.Debug(`Execute the after aspect ${classes.name} ${aopName}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        aopName === "__after" ? await Reflect.apply(this.__after, this, props) :
          await executeAspect(container, aopName, props);
      }
      return res;
    }
  });
}

/**
 * Execute aspect
 * @param container 
 * @param aopName 
 * @param props 
 * @returns 
 */
async function executeAspect(container: IContainer, aopName: string, props: any[]) {
  const aspect: IAspect = container.get(aopName, "COMPONENT");
  if (!aspect || !helper.isFunction(aspect.run))
    throw Error(`Failed to obtain slice class ${aopName} instance`);
  return aspect.run(...props);
}


/**
 * inject default AOP
 *
 * @export
 * @param {IContainer} container
 * @param {Function} target
 * @param {object} prototypeChain
 * @param {string[]} methods
 * @returns {*}
 */
function injectDefaultAOP(container: IContainer, target: Function, prototypeChain: any, methods: string[]) {
  methods.forEach((element) => {
    if (helper.isFunction(prototypeChain.__before)) {
      logger.Debug(`The ${target.name} class has AOP method '__before', @BeforeEach is not take effect`);
      logger.Debug(`Register inject default AOP ${target.name} method: ${element} => __before`);
      defineAOPProperty(container, target, prototypeChain, element, "__before", AOPType.BeforeEach);
    }
    if (helper.isFunction(prototypeChain.__after)) {
      logger.Debug(`The ${target.name} class has AOP method '__after', @AfterEach is not take effect`);
      logger.Debug(`Register inject default AOP ${target.name} method: ${element} => __after`);
      defineAOPProperty(container, target, prototypeChain, element, "__after", AOPType.AfterEach);
    }
  });
}