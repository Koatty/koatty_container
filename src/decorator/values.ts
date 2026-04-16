/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
import * as helper from "koatty_lib";
import { IOC } from "../container/container";
import { TAGGED_ARGS } from "../container/icontainer";

/**
 * Property decorator that assigns a value to a class property.
 * 
 * Supports both legacy and TC39 field decorator calling conventions.
 * Supports an optional `expectedType` parameter to bypass `Reflect.getMetadata("design:type")`,
 * enabling compatibility with esbuild/SWC and other modern build tools that do not
 * support `emitDecoratorMetadata`.
 * 
 * @param value - The value to assign or a function that returns the value
 * @param defaultValue - Optional default value if the main value is empty
 * @param expectedType - Optional explicit type constructor (e.g. `String`, `Number`, `Boolean`)
 *   for type checking. When provided, skips `Reflect.getMetadata("design:type")`.
 * @throws {Error} When the assigned value type doesn't match the property type
 * 
 * @example
 * ```ts
 * class Example {
 *   // With explicit type (no design:type needed)
 *   @Values('test', undefined, String)
 *   name: string;
 * 
 *   // Without explicit type (requires emitDecoratorMetadata)
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
export function Values(value: unknown | Function, defaultValue?: unknown, expectedType?: Function) {
  return IOC.createDecorator({
    legacy: (target: object, propertyKey: string | symbol) => {
      const paramTypes = expectedType ?? Reflect.getMetadata("design:type", target, propertyKey);
      let targetValue = value;

      if (!helper.isFunction(targetValue)) {
        if (defaultValue !== undefined) {
          targetValue = helper.isTrueEmpty(targetValue) ? defaultValue : targetValue;
        }

        if (paramTypes && targetValue !== null && targetValue !== undefined) {
          const expectedTypeName = (paramTypes as Function).name?.toLowerCase();
          const actualType = typeof targetValue;

          const typeMapping: Record<string, string[]> = {
            'string': ['string'],
            'number': ['number'],
            'boolean': ['boolean'],
            'object': ['object'],
            'array': ['object'],
            'date': ['object'],
          };

          const allowedTypes = typeMapping[expectedTypeName] || [expectedTypeName];

          if (expectedTypeName && !allowedTypes.includes(actualType)) {
            throw new Error(`Type mismatch: expected ${expectedTypeName}, but received ${actualType} for property '${String(propertyKey)}'`);
          }
        }
      }

      IOC.savePropertyData(TAGGED_ARGS, {
        name: propertyKey,
        method: targetValue,
      }, target, propertyKey);
    },
    tc39: (context: any) => {
      const fieldName = String(context.name);
      let targetValue = value;

      if (!helper.isFunction(targetValue)) {
        if (defaultValue !== undefined) {
          targetValue = helper.isTrueEmpty(targetValue) ? defaultValue : targetValue;
        }

        if (expectedType && targetValue !== null && targetValue !== undefined) {
          const expectedTypeName = (expectedType as Function).name?.toLowerCase();
          const actualType = typeof targetValue;

          const typeMapping: Record<string, string[]> = {
            'string': ['string'],
            'number': ['number'],
            'boolean': ['boolean'],
            'object': ['object'],
            'array': ['object'],
            'date': ['object'],
          };

          const allowedTypes = typeMapping[expectedTypeName] || [expectedTypeName];

          if (expectedTypeName && !allowedTypes.includes(actualType)) {
            throw new Error(`Type mismatch: expected ${expectedTypeName}, but received ${actualType} for property '${fieldName}'`);
          }
        }
      }

      context.addInitializer(function (this: any) {
        IOC.savePropertyData(TAGGED_ARGS, {
          name: fieldName,
          method: targetValue,
        }, Object.getPrototypeOf(this), fieldName);
      });
    }
  }, 'field');
}
