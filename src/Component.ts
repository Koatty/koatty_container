/*
 * @Description: component interface
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 21:56:32
 * @LastEditTime: 2024-11-05 10:03:04
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { DefaultLogger as log } from "koatty_logger";
import "reflect-metadata";
import { IOCContainer } from "./Container";
import { CONTROLLER_ROUTER } from "./IContainer";

/**
 * Indicates that an decorated class is a "component".
 *
 * @export
 * @param {string} [identifier] component name
 * @returns {ClassDecorator}
 */
export function Component(identifier?: string): ClassDecorator {
  return (target: Function) => {
    identifier = identifier || IOCContainer.getIdentifier(target);
    IOCContainer.saveClass("COMPONENT", target, identifier);
  };
}

/**
 * Indicates that an decorated class is a "controller".
 *
 * @export
 * @param {string} [path] controller router path
 * @param {object} [options] controller router options, the feature is not implemented yet (lll￢ω￢)
 * @returns {ClassDecorator}
 */
export function Controller(path = "", options?: object): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  options ? log.Debug("") : "";
  return (target: Function) => {
    const identifier = IOCContainer.getIdentifier(target);
    IOCContainer.saveClass("CONTROLLER", target, identifier);
    IOCContainer.savePropertyData(CONTROLLER_ROUTER, path, target, identifier);
  };
}

/**
 * Indicates that an decorated class is a "middleware".
 *
 * @export
 * @param {string} [identifier] class name
 * @returns {ClassDecorator}
 */
export function Middleware(identifier?: string): ClassDecorator {
  return (target: Function) => {
    identifier = identifier || IOCContainer.getIdentifier(target);
    IOCContainer.saveClass("MIDDLEWARE", target, identifier);
  };
}

/**
 * Indicates that an decorated class is a "service".
 *
 * @export
 * @param {string} [identifier] class name
 * @returns {ClassDecorator}
 */
export function Service(identifier?: string): ClassDecorator {
  return (target: Function) => {
    identifier = identifier || IOCContainer.getIdentifier(target);
    IOCContainer.saveClass("SERVICE", target, identifier);
  };
}
