/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-02-26 17:09:48
 * @LastEditTime: 2025-02-26 17:09:49
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { DefaultLogger as logger } from "koatty_logger";
import {
  IContainer, ObjectDefinitionOptions,
  TAGGED_PROP
} from "../container/IContainer";
import { recursiveGetMetadata } from "../utils/Util";

/**
 * Inject autowired dependencies into the target class.
 * 
 * @param target The target class constructor function
 * @param prototypeChain The prototype chain object of the target class
 * @param container The IoC container instance
 * @param options Object definition options for dependency injection
 * @param isLazy Whether to use lazy loading for dependencies
 * 
 * @throws {Error} When a required dependency is not found and lazy loading is disabled
 * 
 * @description
 * This function handles the injection of autowired dependencies by:
 * - Retrieving metadata for tagged properties
 * - Processing each dependency based on its type and identifier
 * - Supporting lazy loading to resolve circular dependencies
 * - Defining properties on the prototype chain for immediate injection
 */
export function injectAutowired(target: Function, prototypeChain: object, container: IContainer,
  options?: ObjectDefinitionOptions, isLazy = false) {
  const metaData = recursiveGetMetadata(container, TAGGED_PROP, target);
  for (const metaKey in metaData) {
    const { type, identifier, delay, args } =
      metaData[metaKey] || { type: "", identifier: "", delay: false, args: [] };
    isLazy = isLazy || delay;
    if (type && identifier) {
      const dep = container.get(identifier, type, args);
      if (!dep) {
        if (!isLazy) {
          throw new Error(
            `Component ${metaData[metaKey].identifier ?? ""} not found. It's inject in class ${target.name}`);
        }
        isLazy = true;
      }

      if (isLazy || options.isAsync) {
        // Delay loading solves the problem of cyclic dependency
        logger.Debug(`Delay loading solves the problem of cyclic dependency(${identifier})`);
        // lazy loading used event emit
        options.isAsync = true;
        const app = container.getApp();
        // lazy inject autowired
        if (app?.once) {
          app.once("appReady", () => injectAutowired(target, prototypeChain, container, options, true));
        }
      } else {
        logger.Debug(
          `Register inject ${target.name} properties key: ${metaKey} => value: ${JSON.stringify(metaData[metaKey])}`);
        Reflect.defineProperty(prototypeChain, metaKey, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: dep
        });
      }
    }
  }
}
