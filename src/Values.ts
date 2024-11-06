/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import { Container, IOC } from "./Container";
import { TAGGED_ARGS } from "./IContainer";
import { RecursiveGetMetadata } from "./Util";

/**
 * Inject class instance property
 *
 * @export
 * @param {*} target
 * @param {*} instance
 * @param {Container} [_container]
 */
export function injectValues(target: any, instance: any, _container?: Container) {
  const metaData = RecursiveGetMetadata(TAGGED_ARGS, target);
  for (const { name, method } of Object.values(metaData)) {
    logger.Debug(`Register inject ${name} properties => value: ${JSON.stringify(metaData[name])}`);
    Reflect.defineProperty(instance, name, {
      enumerable: true,
      configurable: false,
      writable: true,
      value: helper.isFunction(method) ? method() : method,
    });
  }
}

/**
 * Indicates that an decorated class instance property values.
 *
 * @export
 * @param {unknown | Function} key
 * @param {unknown} [defaultValue]
 * @returns {*}  {PropertyDecorator}
 */
export function Values(value: unknown | Function, defaultValue?: unknown): PropertyDecorator {
  return (target: object, propertyKey: string) => {
    const paramTypes = Reflect.getMetadata("design:type", target, propertyKey);
    const types = paramTypes.name || "object";
    IOC.savePropertyData(TAGGED_ARGS, {
      name: propertyKey,
      method: () => {
        let targetValue = value;
        if (helper.isFunction(value)) {
          targetValue = value();
        }
        if (defaultValue !== undefined) {
          targetValue = helper.isTrueEmpty(targetValue) ? defaultValue : targetValue;
        }
        if (typeof targetValue !== types.toLowerCase()) {
          throw new Error("The type of the value is not the same as the type of the parameter");
        }
        return targetValue;
      }
    }, target, propertyKey);
  };
}