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
import { getMethodNames } from "../utils/MetadataOpertor";


/**
 * Inject AOP (Aspect-Oriented Programming) functionality into a target class.
 * 
 * @param target The target class constructor function
 * @param prototypeChain The prototype chain of the target class
 * @param container The IoC container instance
 * @param _options Optional object definition options
 * 
 * This function handles:
 * - Default AOP methods (__before, __after)
 * - Custom AOP decorators (Before, BeforeEach, After, AfterEach)
 * - Method filtering and injection of AOP functionality
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
 * Check whether the target class contains default AOP methods.
 * 
 * @param target The target class to check
 * @returns {boolean} True if the target class contains __before or __after method, otherwise false
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
 * Defines an AOP (Aspect-Oriented Programming) property on a class method.
 * 
 * @param container - The IoC container instance
 * @param classes - The target class constructor
 * @param prototypeChain - The prototype chain object containing the method
 * @param protoName - The name of the method to apply AOP
 * @param aopName - The name of the aspect method to execute
 * @param type - The type of AOP (Before, After, BeforeEach, AfterEach)
 * @throws Error if the target method does not exist
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
 * Execute an aspect with the given aspect name and parameters.
 * 
 * @param container The dependency injection container instance
 * @param aopName The name of the aspect to execute
 * @param props Array of parameters to pass to the aspect's run method
 * @returns Promise<any> The result of executing the aspect
 * @throws Error if aspect instance cannot be obtained or doesn't have a run method
 */
async function executeAspect(container: IContainer, aopName: string, props: any[]) {
  const aspect: IAspect = container.get(aopName, "COMPONENT");
  if (!aspect || !helper.isFunction(aspect.run))
    throw Error(`Failed to obtain slice class ${aopName} instance`);
  return aspect.run(...props);
}

/**
 * Injects default AOP (Aspect-Oriented Programming) methods for a given target class.
 * Checks for '__before' and '__after' methods in the prototype chain and registers them as AOP hooks.
 * 
 * @param container - The dependency injection container instance
 * @param target - The target class constructor
 * @param prototypeChain - The prototype chain object containing AOP methods
 * @param methods - Array of method names to apply AOP
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