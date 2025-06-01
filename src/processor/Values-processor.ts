/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-02-26 17:11:05
 * @LastEditTime: 2025-02-26 18:11:10
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import {
  IContainer, ObjectDefinitionOptions,
  TAGGED_ARGS
} from "../container/IContainer";
import { recursiveGetMetadata } from "../utils/MetadataOpertor";

/**
 * Inject values into the target class prototype chain.
 * 
 * @param target The target class constructor
 * @param prototypeChain The prototype chain object to inject properties into
 * @param container Optional IoC container instance
 * @param _options Optional object definition options
 * 
 * @description
 * This function injects values into class properties by recursively getting metadata
 * from the container. It supports both direct values and function-returned values.
 * The injected properties are defined as enumerable and writable but not configurable.
 */
export function injectValues(target: Function, prototypeChain: object,
  container?: IContainer, _options?: ObjectDefinitionOptions) {
  const metaData = recursiveGetMetadata(container, TAGGED_ARGS, target);
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
