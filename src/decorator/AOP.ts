/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { Helper } from "koatty_lib";
import { IOC } from "../container/Container";
import { AOPType, ClassOrString, TAGGED_AOP, TAGGED_CLS } from "../container/IContainer";


/**
 * Aspect decorator for AOP implementation.
 * Used to mark a class as an Aspect class in the IOC container.
 * 
 * @param identifier Optional custom identifier for the Aspect class
 * @throws {Error} When class name doesn't end with 'Aspect' suffix
 * @throws {Error} When class doesn't implement the 'run' method
 * @example
 * ```typescript
 * @Aspect()
 * class LoggerAspect {
 *   run() { }
 * }
 * ```
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
 * Method decorator for defining "Before" aspect-oriented programming interceptors.
 * Executes the specified AOP handler before the decorated method.
 * 
 * @param aopName The name of the AOP handler to be executed
 * @throws {Error} When aopName parameter is empty or undefined
 * @returns {MethodDecorator} A decorator function that attaches AOP metadata to the target method
 * 
 * @example
 * ```typescript
 * @Before('logBefore')
 * public async getData() {
 *   // method implementation
 * }
 * ```
 */
export function Before<T>(paramName: ClassOrString<T>): MethodDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = paramName?.name;
  }
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
 * Decorator that registers a BeforeEach AOP interceptor for the class.
 * Executes before each method in the decorated class.
 * 
 * @param aopName The name identifier for the AOP interceptor
 * @returns ClassDecorator function that attaches AOP metadata to the target class
 * 
 * @example
 * ```
 * @BeforeEach('logBefore')
 * class UserService {
 *   // ...
 * }
 * ```
 */
export function BeforeEach<T>(paramName: ClassOrString<T>): ClassDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = paramName?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.BeforeEach,
      name: aopName
    }, target);
  };
}

/**
 * After decorator, used to define an after aspect for a method.
 * The aspect will be executed after the decorated method.
 * 
 * @export
 * @param {string} aopName The name of the aspect to be executed
 * @returns {MethodDecorator} Method decorator
 * @throws {Error} When aopName is not provided
 * 
 * @example
 * ```typescript
 * @After('logAspect')
 * public async someMethod() {
 *   // method implementation
 * }
 * ```
 */
export function After<T>(paramName: ClassOrString<T>): MethodDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = paramName?.name;
  }
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
 * Decorator that registers an AfterEach AOP aspect for a class.
 * The aspect will be executed after each method of the decorated class.
 * 
 * @param aopName The name identifier for the AOP aspect
 * @returns A class decorator function
 * 
 * @example
 * ```typescript
 * @AfterEach('logAfter')
 * class MyClass {}
 * ```
 */
export function AfterEach<T>(paramName: ClassOrString<T>): ClassDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = paramName?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AfterEach,
      name: aopName
    }, target);
  };
}

