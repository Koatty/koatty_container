/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
// tslint:disable-next-line: no-import-side-effect
import * as helper from "koatty_lib";
import "reflect-metadata";
import { IOC } from "../container/Container";
import { ClassOrString, TAGGED_PROP } from "../container/IContainer";
import { getComponentTypeByClassName } from "../utils/MetadataOpertor";

/**
 * Decorator that marks a property for dependency injection.
 * 
 * @param paramName - The class or string identifier for the dependency
 * @param cType - The component type of the dependency
 * @param constructArgs - Constructor arguments for the dependency instance
 * @param isDelay - Whether to delay the injection (default: false)
 * @returns A property decorator function
 * @throws Error if injection type is incorrect or if trying to inject a controller
 * @example
 * ```typescript
 * @Autowired()
 * private userService: UserService;
 * 
 * @Autowired('UserService')
 * private userService: UserService;
 * * ```
 */
export function Autowired<T>(paramName?: ClassOrString<T>, cType: string = "COMPONENT", constructArgs?: any[],
  isDelay = false): PropertyDecorator {
  return (target: object, propertyKey: string) => {
    const designType = Reflect.getMetadata("design:type", target, propertyKey);
    let identifier = designType?.name;
    
    // If paramName is provided (string or class), use it as the identifier
    if (paramName) {
      if (helper.isString(paramName)) {
        identifier = helper.camelCase(paramName, true);
      } else {
        identifier = paramName?.name;
      }
    } else if (!identifier || identifier === "Object") {
      // Only throw error if no paramName is provided and we can't infer the type
      throw Error("Autowired should refuse to inject incorrect types. Please provide a paramName or use explicit typing.");
    }

    if (!identifier) {
      throw Error("Autowired should refuse to inject incorrect types.");
    }
    if (cType === undefined) {
      cType = getComponentTypeByClassName(identifier);
    }
    //Cannot rely on injection controller
    if (cType === "CONTROLLER") {
      throw new Error(`Controller bean cannot be injection!`);
    }

    // Set delay to true when:
    // 1. Explicitly requested (isDelay = true)
    // 2. Design type is Object (indicating any type or circular reference)
    // 3. String identifier is used without proper typing
    const shouldDelay = isDelay || !designType || designType.name === "Object" || helper.isString(paramName);

    IOC.savePropertyData(TAGGED_PROP, {
      type: cType,
      identifier,
      delay: shouldDelay,
      args: constructArgs ?? []
    }, target, propertyKey);
  };
}

/**
 * Parameter decorator for dependency injection.
 * Used to inject dependencies into constructor parameters.
 * 
 * @param paramName Optional class or string identifier for the dependency
 * @param cType Optional component type for the dependency
 * @throws {Error} When used on non-constructor parameters
 * @throws {Error} When attempting to inject a controller component
 * 
 * @example
 * ```typescript
 * class Service {
 *   constructor(@Inject() dependency: Dependency) {}
 * }
 * ```
 */
export function Inject<T>(paramName?: ClassOrString<T>, cType: string = "COMPONENT"): ParameterDecorator {
  return (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    if (propertyKey) {
      throw new Error("the Inject decorator only used by constructor method");
    }
    // 获取成员参数类型
    const paramTypes = Reflect.getMetadata("design:paramtypes", target, propertyKey);
    let identifier = paramTypes[parameterIndex]?.name;
    if (!identifier || identifier === "Object") {
      if (helper.isString(paramName)) {
        propertyKey = paramName;
        identifier = helper.camelCase(paramName, true);
      } else {
        identifier = paramName?.name;
        propertyKey = helper.camelCase(paramName?.name);
      }
    } else {
      propertyKey = helper.camelCase(identifier);
    }

    if (cType === undefined) {
      cType = getComponentTypeByClassName(identifier);
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
