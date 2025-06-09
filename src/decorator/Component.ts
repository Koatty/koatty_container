/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2025-06-02 11:19:30
 */

import { IOC } from "../container/container";


/**
 * Component decorator, used to mark a class as a component and register it to IOC container.
 * 
 * @param identifier Optional identifier for the component. If not provided, will use the class name.
 * @returns ClassDecorator function that registers the target class as a component.
 * 
 * @example
 * ```ts
 * @Component()
 * class UserDto {}
 * 
 * @Component('customName')
 * class OrderClass {}
 * ```
 */
export function Component(identifier?: string, type: string = "COMPONENT"): ClassDecorator {
  return (target: Function) => {
    identifier = identifier || IOC.getIdentifier(target);
    IOC.saveClass(type, target, identifier);
  };
}