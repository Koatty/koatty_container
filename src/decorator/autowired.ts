/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
// tslint:disable-next-line: no-import-side-effect
import * as helper from "koatty_lib";
import "reflect-metadata";
import { DefaultLogger as logger } from "koatty_logger";
import { IOC } from "../container/container";
import { ClassOrString, TAGGED_PROP } from "../container/icontainer";
import { getComponentTypeByClassName } from "../utils/operator";

/**
 * Decorator that marks a property for dependency injection.
 * 
 * Supports both legacy and TC39 field decorator calling conventions.
 * Supports explicit type parameter to bypass `Reflect.getMetadata("design:type")`,
 * enabling compatibility with esbuild/SWC and other modern build tools that do not
 * support `emitDecoratorMetadata`.
 * 
 * @param paramName - The class or string identifier for the dependency.
 *   - When a **class** is provided, it is used directly as the type identifier
 *     without querying `design:type`, enabling use without `emitDecoratorMetadata`.
 *   - When a **string** is provided, it is used as the identifier.
 *   - When **undefined**, falls back to `Reflect.getMetadata("design:type")` (legacy mode)
 *     or uses the field name as identifier (TC39 mode).
 * @param cType - The component type of the dependency
 * @param constructArgs - Constructor arguments for the dependency instance
 * @param isDelay - Whether to delay the injection (default: false)
 * @throws Error if injection type is incorrect or if trying to inject a controller
 * @example
 * ```typescript
 * // Explicit class type (no design:type needed)
 * @Autowired(UserService)
 * private userService: UserService;
 * 
 * // String identifier (no design:type needed)
 * @Autowired('UserService')
 * private userService: UserService;
 * 
 * // Auto-infer from design:type (requires emitDecoratorMetadata, legacy only)
 * @Autowired()
 * private userService: UserService;
 * ```
 */
export function Autowired<T>(paramName?: ClassOrString<T>, cType: string = "COMPONENT", constructArgs?: any[],
  isDelay = false) {
  return IOC.createDecorator({
    legacy: (target: object, propertyKey: string | symbol) => {
      let designType: Function | undefined;
      let identifier: string | undefined;

      if (paramName !== undefined && paramName !== null) {
        if (helper.isString(paramName)) {
          identifier = helper.camelCase(paramName, true);
        } else {
          identifier = (paramName as new () => T)?.name;
        }
      } else {
        designType = Reflect.getMetadata("design:type", target, propertyKey);
        identifier = designType?.name;

        if (!identifier || identifier === "Object") {
          throw Error("Autowired should refuse to inject incorrect types. Please provide a paramName or use explicit typing.");
        }
      }

      if (!identifier) {
        throw Error("Autowired should refuse to inject incorrect types.");
      }
      if (cType === undefined) {
        cType = getComponentTypeByClassName(identifier);
      }
      if (cType === "CONTROLLER") {
        throw new Error(`Controller bean cannot be injection!`);
      }

      const shouldDelay = isDelay || (!paramName && (!designType || designType?.name === "Object")) || helper.isString(paramName);

      IOC.savePropertyData(TAGGED_PROP, {
        type: cType,
        identifier,
        delay: shouldDelay,
        args: constructArgs ?? []
      }, target, propertyKey);
    },
    tc39: (context: any) => {
      const fieldName = String(context.name);
      let identifier: string | undefined;

      if (paramName !== undefined && paramName !== null) {
        if (helper.isString(paramName)) {
          identifier = helper.camelCase(paramName, true);
        } else {
          identifier = (paramName as new () => T)?.name;
        }
      } else {
        identifier = helper.camelCase(fieldName, true);
      }

      if (!identifier) {
        throw Error("Autowired should refuse to inject incorrect types.");
      }
      let resolvedCType = cType;
      if (resolvedCType === undefined) {
        resolvedCType = getComponentTypeByClassName(identifier);
      }
      if (resolvedCType === "CONTROLLER") {
        throw new Error(`Controller bean cannot be injection!`);
      }

      const shouldDelay = isDelay || !paramName || helper.isString(paramName);

      context.addInitializer(function (this: any) {
        IOC.savePropertyData(TAGGED_PROP, {
          type: resolvedCType,
          identifier,
          delay: shouldDelay,
          args: constructArgs ?? []
        }, Object.getPrototypeOf(this), fieldName);
      });
    }
  }, 'field');
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
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey) {
      throw new Error("the Inject decorator only used by constructor method");
    }
    const paramTypes = propertyKey != null
      ? Reflect.getMetadata("design:paramtypes", target, propertyKey as string | symbol)
      : Reflect.getMetadata("design:paramtypes", target);
    if (paramTypes === undefined) {
      logger.Warn(`Inject decorator: design:paramtypes metadata is undefined for target. Please ensure "emitDecoratorMetadata: true" is enabled in your tsconfig.json.`);
    }
    let identifier = paramTypes?.[parameterIndex]?.name;
    if (!identifier || identifier === "Object") {
      if (helper.isString(paramName)) {
        propertyKey = paramName;
        identifier = helper.camelCase(paramName, true);
      } else {
        identifier = paramName?.name;
        propertyKey = helper.camelCase(paramName?.name ?? '');
      }
    } else {
      propertyKey = helper.camelCase(identifier);
    }

    if (cType === undefined) {
      cType = getComponentTypeByClassName(identifier);
    }
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
