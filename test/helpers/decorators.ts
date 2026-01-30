/**
 * Test helper decorators for koatty-container
 * These are simplified versions for testing purposes only
 * 
 * In production, use the Component decorator from koatty_core package
 */

import { IOC } from "../../src/container/container";

/**
 * Component decorator for testing purposes
 * In production code, use the Component decorator from koatty_core
 */
export function Component(identifier?: string, type: string = "COMPONENT"): ClassDecorator {
  return (target: Function) => {
    identifier = identifier || IOC.getIdentifier(target);
    IOC.saveClass(type, target, identifier);
  };
}
