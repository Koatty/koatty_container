/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-02-26 17:11:05
 * @LastEditTime: 2025-02-26 17:42:47
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import { IContainer, ObjectDefinitionOptions, TAGGED_ARGS } from "../container/IContainer";
import { RecursiveGetMetadata } from "../utils/Util";

/**
 * Inject class instance property
 * @param target 
 * @param prototypeChain 
 * @param _container 
 * @param _options 
 */
export function injectValues(target: Function, prototypeChain: object,
  container?: IContainer, _options?: ObjectDefinitionOptions) {
  const metaData = RecursiveGetMetadata(container, TAGGED_ARGS, target);
  for (const { name, method } of Object.values(metaData)) {
    logger.Debug(`Register inject ${name} properties => value: ${JSON.stringify(metaData[name])}`);
    let targetValue = method;
    if (helper.isFunction(method)) {
      targetValue = method();
    }
    Reflect.defineProperty(prototypeChain, name, {
      enumerable: true,
      configurable: false,
      writable: true,
      value: targetValue,
    });
  }
}
