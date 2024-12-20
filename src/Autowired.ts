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
 * Marks a class property as to be autowired by Koatty"s dependency injection facilities.
 *
 * @export
 * @param {string} [identifier]
 * @param {ComponentType} [cType]
 * @param {any[]} [constructArgs]
 * @param {boolean} [isDelay=false]
 * @returns {PropertyDecorator}
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
/**
 * Marks a constructor method's parameter as to be Inject by Koatty"s dependency injection facilities.
 * 
 * @export
 * @param {string} [identifier]
 * @param {ComponentType} [cType]
 * @param {any[]} [constructArgs]
 * @param {boolean} [isDelay=false]
 * @returns {PropertyDecorator}
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
