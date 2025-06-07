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
 * Used to mark a class as an Aspect PointCut in the AOP system.
 * 
 * @param identifier Optional custom identifier for the Aspect class
 * @throws {Error} When class name doesn't end with 'Aspect' suffix
 * @throws {Error} When class doesn't implement 'run' method
 * @returns {ClassDecorator} Class decorator function
 * 
 * @example
 * ```typescript
 * @Aspect()
 * class LoggingAspect {
 *   run() {
 *     // aspect implementation
 *   }
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
 * Before decorator, used to define a method-level AOP interceptor that executes before the target method.
 * 
 * @export
 * @param {ClassOrString<T>} paramName - The name or class of the AOP interceptor
 * @returns {MethodDecorator} A method decorator that attaches AOP metadata
 * @throws {Error} When AOP name is not provided
 * 
 * @example
 * ```typescript
 * @Before('LogInterceptor')
 * someMethod() {}
 * ```
 */
export function Before<T>(paramName: ClassOrString<T>): MethodDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = (paramName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: string, _descriptor: PropertyDescriptor) => {
    const order = Date.now() + Math.random(); // 确保唯一性，用于处理重复装饰器
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.Before,
      name: aopName,
      method: methodName,
      order
    }, target);
  };
}

/**
 * Decorator that marks a class to execute before each method.
 * 
 * @param paramName - The name of the AOP class or string identifier
 * @returns ClassDecorator function that attaches AOP metadata to the target class
 * @throws Error if AOP name is not provided
 * 
 * @example
 * ```typescript
 * @BeforeEach(LoggerAspect)
 * class UserService {}
 * ```
 */
export function BeforeEach<T>(paramName: ClassOrString<T>): ClassDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = (paramName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    const order = Date.now() + Math.random(); // 确保唯一性，用于处理重复装饰器
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.BeforeEach,
      name: aopName,
      order
    }, target);
  };
}

/**
 * After decorator, used to define an after aspect for a method.
 * The aspect will be executed after the decorated method.
 * 
 * @export
 * @param {ClassOrString<T>} paramName - The name or class of the AOP handler
 * @returns {MethodDecorator} Method decorator
 * @throws {Error} When AopName is not provided
 * 
 * @example
 * ```typescript
 * @After('LogAspect')
 * someMethod() {}
 * ```
 */
export function After<T>(paramName: ClassOrString<T>): MethodDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = (paramName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: symbol | string, _descriptor: PropertyDescriptor) => {
    const order = Date.now() + Math.random(); // 确保唯一性，用于处理重复装饰器
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.After,
      name: aopName,
      method: methodName,
      order
    }, target);
  };
}

/**
 * Decorator that marks a class to execute after each method.
 * 
 * @export
 * @param {ClassOrString<T>} paramName The AOP class name or string identifier
 * @returns {ClassDecorator} Class decorator function
 * @throws {Error} When AopName is not provided
 * 
 * @example
 * ```typescript
 * @AfterEach(LoggerAspect)
 * class UserService {}
 * ```
 */
export function AfterEach<T>(paramName: ClassOrString<T>): ClassDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = (paramName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    const order = Date.now() + Math.random(); // 确保唯一性，用于处理重复装饰器
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AfterEach,
      name: aopName,
      order
    }, target);
  };
}

/**
 * Around decorator, used to define a method-level AOP interceptor that wraps around the target method.
 * The around aspect can control whether the original method is executed and can modify arguments and return values.
 * 
 * @export
 * @param {ClassOrString<T>} paramName - The name or class of the AOP interceptor
 * @returns {MethodDecorator} A method decorator that attaches AOP metadata
 * @throws {Error} When AOP name is not provided
 * 
 * @example
 * ```typescript
 * @Around('TransactionAspect')
 * someMethod() {}
 * ```
 */
export function Around<T>(paramName: ClassOrString<T>): MethodDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = (paramName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: string, _descriptor: PropertyDescriptor) => {
    const order = Date.now() + Math.random(); // 确保唯一性，用于处理重复装饰器
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.Around,
      name: aopName,
      method: methodName,
      order
    }, target);
  };
}

/**
 * Decorator that marks a class to execute around each method.
 * The around aspect wraps around every method in the target class.
 * 
 * @export
 * @param {ClassOrString<T>} paramName The AOP class name or string identifier
 * @returns {ClassDecorator} Class decorator function
 * @throws {Error} When AOP name is not provided
 * 
 * @example
 * ```typescript
 * @AroundEach(TransactionAspect)
 * class UserService {}
 * ```
 */
export function AroundEach<T>(paramName: ClassOrString<T>): ClassDecorator {
  let aopName = paramName;
  if (!Helper.isString(paramName)) {
    aopName = (paramName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    const order = Date.now() + Math.random(); // 确保唯一性，用于处理重复装饰器
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AroundEach,
      name: aopName,
      order
    }, target);
  };
}

