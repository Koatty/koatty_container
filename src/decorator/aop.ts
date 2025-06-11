/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { Helper } from "koatty_lib";
import { IOC } from "../container/container";
import { AOPType, ClassOrString, TAGGED_AOP, TAGGED_CLS } from "../container/icontainer";

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
 *   run(args: any[], proceed?: Function): Promise<any> {
 *     console.log('Before method execution');
 *     const result = await proceed?.(args);
 *     console.log('After method execution');
 *     return result;
 *   }
 * }
 * ```
 */
export const Aspect = (identifier?: string): ClassDecorator => {
  return (target: any) => {
    // Validate class name ends with 'Aspect'
    if (!target.name.endsWith('Aspect')) {
      throw new Error("Aspect class names must use a suffix `Aspect`.");
    }

    // Validate class has 'run' method
    if (!target.prototype.run || typeof target.prototype.run !== 'function') {
      throw new Error("The aspect class must implement the `run` method.");
    }
    IOC.saveClass("COMPONENT", target, identifier);
  };
};

/**
 * Before decorator for AOP implementation.
 * Executes the specified aspect before the target method.
 * 
 * @param aopName The name or class of the aspect to execute
 * @param options Optional configuration for the aspect
 * @returns {MethodDecorator} Method decorator function
 * 
 * @example
 * ```typescript
 * class UserService {
 *   @Before(LoggingAspect)
 *   async getUser(id: string) {
 *     return await this.userRepository.findById(id);
 *   }
 * }
 * ```
 */
export const Before = <T>(aopName: ClassOrString<T>, options?: any): MethodDecorator => {

  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: string | symbol, _descriptor: PropertyDescriptor) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.Before,
      name: aopName,
      method: methodName,
      options
    }, target);
  };
};

/**
 * After decorator for AOP implementation.
 * Executes the specified aspect after the target method.
 * 
 * @param aopName The name or class of the aspect to execute
 * @param options Optional configuration for the aspect
 * @returns {MethodDecorator} Method decorator function
 * 
 * @example
 * ```typescript
 * class UserService {
 *   @After(AuditAspect)
 *   async updateUser(id: string, data: any) {
 *     return await this.userRepository.update(id, data);
 *   }
 * }
 * ```
 */
export const After = <T>(aopName: ClassOrString<T>, options?: any): MethodDecorator => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: string | symbol, _descriptor: PropertyDescriptor) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.After,
      name: aopName,
      method: methodName,
      options
    }, target);
  };
};

/**
 * Around decorator for AOP implementation.
 * Wraps the target method execution with the specified aspect.
 * 
 * @param aopName The name or class of the aspect to execute
 * @param options Optional configuration for the aspect
 * @returns {MethodDecorator} Method decorator function
 * 
 * @example
 * ```typescript
 * class UserService {
 *   @Around(TransactionAspect)
 *   async createUser(userData: any) {
 *     return await this.userRepository.create(userData);
 *   }
 * }
 * ```
 */
export const Around = <T>(aopName: ClassOrString<T>, options?: any): MethodDecorator => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function, methodName: string | symbol, _descriptor: PropertyDescriptor) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.Around,
      name: aopName,
      method: methodName,
      options
    }, target);
  };
};

/**
 * BeforeEach decorator for AOP implementation.
 * Executes the specified aspect before each method in the target class.
 * 
 * @param aopName The name or class of the aspect to execute
 * @param options Optional configuration for the aspect
 * @returns {ClassDecorator} Class decorator function
 * 
 * @example
 * ```typescript
 * @BeforeEach(LoggingAspect)
 * class UserService {
 *   async getUser(id: string) { ... }
 *   async updateUser(id: string, data: any) { ... }
 * }
 * ```
 */
export const BeforeEach = <T>(aopName: ClassOrString<T>, options?: any): ClassDecorator => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.BeforeEach,
      name: aopName,
      method: "*",
      options
    }, target);
  };
};

/**
 * AfterEach decorator for AOP implementation.
 * Executes the specified aspect after each method in the target class.
 * 
 * @param aopName The name or class of the aspect to execute
 * @param options Optional configuration for the aspect
 * @returns {ClassDecorator} Class decorator function
 * 
 * @example
 * ```typescript
 * @AfterEach(AuditAspect)
 * class UserService {
 *   async getUser(id: string) { ... }
 *   async updateUser(id: string, data: any) { ... }
 * }
 * ```
 */
export const AfterEach = <T>(aopName: ClassOrString<T>, options?: any): ClassDecorator => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AfterEach,
      name: aopName,
      method: "*",
      options
    }, target);
  };
};

/**
 * AroundEach decorator for AOP implementation.
 * Wraps each method execution in the target class with the specified aspect.
 * 
 * @param aopName The name or class of the aspect to execute
 * @param options Optional configuration for the aspect
 * @returns {ClassDecorator} Class decorator function
 * 
 * @example
 * ```typescript
 * @AroundEach(TransactionAspect)
 * class UserService {
 *   async getUser(id: string) { ... }
 *   async updateUser(id: string, data: any) { ... }
 * }
 * ```
 */
export const AroundEach = <T>(aopName: ClassOrString<T>, options?: any): ClassDecorator => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return (target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AroundEach,
      name: aopName,
      method: "*",
      options
    }, target);
  };
};

