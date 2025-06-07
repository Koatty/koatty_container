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
    let targetValue = value;
    
    if (!helper.isFunction(targetValue)) {
      if (defaultValue !== undefined) {
        targetValue = helper.isTrueEmpty(targetValue) ? defaultValue : targetValue;
      }
      
      // 改进的类型检查逻辑
      if (paramTypes && targetValue !== null && targetValue !== undefined) {
        const expectedType = paramTypes.name?.toLowerCase();
        const actualType = typeof targetValue;
        
        // 支持的类型映射
        const typeMapping: Record<string, string[]> = {
          'string': ['string'],
          'number': ['number'],
          'boolean': ['boolean'],
          'object': ['object'],
          'array': ['object'], // Array 在 typeof 中返回 object
          'date': ['object'],   // Date 在 typeof 中返回 object
        };
        
        const allowedTypes = typeMapping[expectedType] || [expectedType];
        
        if (expectedType && !allowedTypes.includes(actualType)) {
          throw new Error(`Type mismatch: expected ${expectedType}, but received ${actualType} for property '${propertyKey}'`);
        }
      }
    }

    IOC.savePropertyData(TAGGED_ARGS, {
      name: propertyKey,
      method: targetValue,
    }, target, propertyKey);
  };
}