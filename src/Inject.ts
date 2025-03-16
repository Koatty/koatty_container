/**
 * 
 * @Author: richen
 * @Date: 2025-03-16 16:24:53
 * @LastEditTime: 2025-03-16 16:26:58
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { IOC } from "./Container";
import { ComponentType, TAGGED_PROP } from "./IContainer";
import * as helper from "koatty_lib";

/**
 * Parameter decorator for dependency injection.
 * Used to inject dependencies into constructor parameters.
 * 
 * @param paramName The name of the parameter to inject
 * @param cType Optional component type. If not provided, it will be inferred from the parameter name
 * @returns ParameterDecorator
 * @throws Error if used on non-constructor parameters or when trying to inject a Controller
 * 
 * @example
 * ```typescript
 * class MyClass {
 *   constructor(@Inject('userService') private userService: UserService) {}
 * }
 * ```
 */
export function Inject(paramName: string, cType?: ComponentType): ParameterDecorator {
  return (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    if (propertyKey) {
      throw new Error("the Inject decorator only used by constructor method");
    }
    // 获取成员参数类型
    const paramTypes = Reflect.getMetadata("design:paramtypes", target, propertyKey);
    let identifier = paramTypes[parameterIndex]?.name;
    identifier = identifier || helper.camelCase(paramName, true);
    propertyKey = paramName;

    if (cType === undefined) {
      if (identifier.includes("Controller")) {
        cType = "CONTROLLER";
      } else if (identifier.includes("Middleware")) {
        cType = "MIDDLEWARE";
      } else if (identifier.includes("Service")) {
        cType = "SERVICE";
      } else {
        cType = "COMPONENT";
      }
    }
    //Cannot rely on injection controller
    if (cType === "CONTROLLER") {
      throw new Error(`Controller bean cannot be injection!`);
    }

    IOC.savePropertyData(TAGGED_PROP, {
      type: cType,
      identifier,
      delay: false,
      args: []
    }, target, propertyKey);
  };
}
