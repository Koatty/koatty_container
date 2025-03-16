/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
// tslint:disable-next-line: no-import-side-effect
import * as helper from "koatty_lib";
import "reflect-metadata";
import { IOC } from "./Container";
import { ComponentType, TAGGED_PROP } from "./IContainer";

/**
 * Property decorator for dependency injection.
 * Automatically injects components into class properties based on their type and identifier.
 * 
 * @param identifier Optional custom identifier for the component. If not provided, uses the design type name or camelCased property key
 * @param cType Optional component type. Auto-detected from identifier if not specified
 * @param constructArgs Optional array of constructor arguments for the component
 * @param isDelay Optional flag to indicate delayed injection, defaults to false
 * @returns PropertyDecorator function
 * @throws Error if identifier is empty with circular dependency
 * @throws Error if attempting to inject a Controller component
 * @example
 * ```typescript
 * // Injects a component into a class property
 * @Autowired()
 * public data: AnyClass;
 * 
 * // Injects a component into a class property with custom identifier
 * @Autowired("myData")
 * public data: AnyClass;
 * 
 * // Injects a component into a class property with custom identifier and component type
 * @Autowired("myData", "SERVICE")
 * public data: AnyClass;
 * 
 * // Injects a component into a class property with custom identifier and component type and constructor arguments
 * @Autowired("myData", "SERVICE", [1, 2, 3])
 * public data: AnyClass;
 * ```
 */
export function Autowired(identifier?: string, cType?: ComponentType, constructArgs?: any[],
  isDelay = false): PropertyDecorator {
  return (target: object, propertyKey: string) => {
    const designType = Reflect.getMetadata("design:type", target, propertyKey);
    identifier = identifier || (designType && designType.name !== "Object" ?
      designType.name : helper.camelCase(propertyKey, true));

    if (!identifier) {
      throw Error("identifier cannot be empty when circular dependency exists");
    }
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

    isDelay = !designType || designType.name === "Object";

    IOC.savePropertyData(TAGGED_PROP, {
      type: cType,
      identifier,
      delay: isDelay,
      args: constructArgs ?? []
    }, target, propertyKey);
  };
}
