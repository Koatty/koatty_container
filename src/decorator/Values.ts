/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
import * as helper from "koatty_lib";
import { IOC } from "../container/Container";
import { TAGGED_ARGS } from "../container/IContainer";

/**
 * Indicates that an decorated class instance property values.
 *
 * @export
 * @param {unknown | Function} key !!!not support async function
 * @param {unknown} [defaultValue]
 * @returns {*}  {PropertyDecorator}
 */
export function Values(value: unknown | Function, defaultValue?: unknown): PropertyDecorator {
  return (target: object, propertyKey: string) => {
    const paramTypes = Reflect.getMetadata("design:type", target, propertyKey);
    const types = paramTypes.name || "object";
    let targetValue = value;
    if (!helper.isFunction(targetValue)) {
      if (defaultValue !== undefined) {
        targetValue = helper.isTrueEmpty(targetValue) ? defaultValue : targetValue;
      }
      if (typeof targetValue !== types.toLowerCase()) {
        throw new Error("The type of the value is not the same as the type of the parameter");
      }
    }

    IOC.savePropertyData(TAGGED_ARGS, {
      name: propertyKey,
      method: targetValue,
    }, target, propertyKey);
  };
}