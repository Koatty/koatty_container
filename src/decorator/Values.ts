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
 * Property decorator that assigns a value to a class property.
 * 
 * @param value - The value to assign or a function that returns the value
 * @param defaultValue - Optional default value if the main value is empty
 * @throws {Error} When the assigned value type doesn't match the property type
 * @returns PropertyDecorator
 * 
 * @example
 * ```ts
 * class Example {
 *   @Values('test')
 *   name: string;
 * 
 *   @Values(null, 'default')
 *   title: string;
 * 
 *   @Values(() => 'value')
 *   title: string;
 * }
 * ```
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