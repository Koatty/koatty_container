/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
// tslint:disable-next-line: no-import-side-effect
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import "reflect-metadata";
import { Container, IOCContainer } from "./Container";
import { ComponentType, TAGGED_PROP } from "./IContainer";
import { RecursiveGetMetadata } from "./Util";

/**
 * Marks a constructor method as to be autowired by Koatty"s dependency injection facilities.
 *
 * @export
 * @param {string} [identifier]
 * @param {ComponentType} [type]
 * @param {any[]} [constructArgs]
 * @param {boolean} [isDelay=false]
 * @returns {PropertyDecorator}
 */
export function Autowired(identifier?: string, type?: ComponentType, constructArgs?: any[], isDelay = false): PropertyDecorator {
  return (target: object, propertyKey: string) => {
    const designType = Reflect.getMetadata("design:type", target, propertyKey);
    identifier = identifier || (designType && designType.name !== "Object" ? designType.name : helper.camelCase(propertyKey, true));

    if (!identifier) {
      throw Error("identifier cannot be empty when circular dependency exists");
    }
    if (type === undefined) {
      if (identifier.includes("Controller")) {
        type = "CONTROLLER";
      } else if (identifier.includes("Middleware")) {
        type = "MIDDLEWARE";
      } else if (identifier.includes("Service")) {
        type = "SERVICE";
      } else {
        type = "COMPONENT";
      }
    }
    //Cannot rely on injection controller
    if (type === "CONTROLLER") {
      throw new Error(`Controller bean cannot be injection!`);
    }

    isDelay = !designType || designType.name === "Object";

    IOCContainer.savePropertyData(TAGGED_PROP, {
      type,
      identifier,
      delay: isDelay,
      args: constructArgs ?? []
    }, target, propertyKey);
  };
}
/**
 * Marks a constructor method as to be Inject by Koatty"s dependency injection facilities.
 * alias for AutoWired
 * @export
 * @param {string} [identifier]
 * @param {ComponentType} [type]
 * @param {any[]} [constructArgs]
 * @param {boolean} [isDelay=false]
 * @returns {PropertyDecorator}
 */
export const Inject = Autowired;

/**
 * inject autowired class
 *
 * @export
 * @param {*} target
 * @param {*} instance
 * @param {Container} container
 * @param {boolean} [isLazy=false]
 */
export function injectAutowired(target: any, instance: any, container: Container, isLazy = false) {
  const metaData = RecursiveGetMetadata(TAGGED_PROP, target);
  for (const metaKey in metaData) {
    const { type, identifier, delay, args } =
      metaData[metaKey] || { type: "", identifier: "", delay: false, args: [] };
    if (type && identifier) {
      if (!delay || isLazy) {
        const dep = container.get(identifier, type, args);
        if (!dep) {
          throw new Error(
            `Component ${metaData[metaKey].identifier ?? ""} not found. It's autowired in class ${target.name}`);
        }
        logger.Debug(
          `Register inject ${target.name} properties key: ${metaKey} => value: ${JSON.stringify(metaData[metaKey])}`);
        Reflect.defineProperty(instance, metaKey, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: dep
        });
      } else {
        // Delay loading solves the problem of cyclic dependency
        logger.Debug(`Delay loading solves the problem of cyclic dependency(${identifier})`)
        const app = container.getApp();
        // lazy inject autowired
        if (app?.once) {
          app.once("appReady", () => injectAutowired(target, instance, container, true));
        }
      }
    }
  }
}
