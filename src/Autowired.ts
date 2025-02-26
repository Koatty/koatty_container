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
import { ClassOrString, ComponentType, TAGGED_PROP } from "./IContainer";
import { getComponentTypeByClassName } from "./Util";

/**
 * Marks a class property as to be autowired by Koatty"s dependency injection facilities.
 *
 * @export
 * @param {ClassOrString} [paramName]
 * @param {ComponentType} [cType]
 * @param {any[]} [constructArgs]
 * @param {boolean} [isDelay=false]
 * @returns {PropertyDecorator}
 */
export function Autowired<T>(paramName?: ClassOrString<T>, cType?: ComponentType, constructArgs?: any[],
  isDelay = false): PropertyDecorator {
  return (target: object, propertyKey: string) => {
    const designType = Reflect.getMetadata("design:type", target, propertyKey);
    let identifier = designType?.name;
    if (!identifier || identifier === "Object") {
      if (helper.isString(paramName)) {
        identifier = helper.camelCase(paramName, true);
      } else {
        identifier = paramName?.name;
      }
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
 * @param {ClassOrString} [identifier]
 * @param {ComponentType} [cType]
 * @param {any[]} [constructArgs]
 * @param {boolean} [isDelay=false]
 * @returns {PropertyDecorator}
 */
export function Inject<T>(paramName?: ClassOrString<T>, cType?: ComponentType): ParameterDecorator {
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
