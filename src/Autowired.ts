/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: MIT
 * @ version: 2020-05-10 11:03:58
 */
// tslint:disable-next-line: no-import-side-effect
import "reflect-metadata";
import * as helper from "think_lib";
import * as logger from "think_logger";
import { Container, IOCContainer } from "./Container";
import { CompomentType, TAGGED_PROP } from "./IContainer";


const functionPrototype = Object.getPrototypeOf(Function);
// get property of an object
// https://tc39.github.io/ecma262/#sec-ordinarygetprototypeof
function ordinaryGetPrototypeOf(obj: any): any {
    const proto = Object.getPrototypeOf(obj);
    if (typeof obj !== "function" || obj === functionPrototype) {
        return proto;
    }

    // TypeScript doesn't set __proto__ in ES5, as it's non-standard.
    // Try to determine the superclass constructor. Compatible implementations
    // must either set __proto__ on a subclass constructor to the superclass constructor,
    // or ensure each class has a valid `constructor` property on its prototype that
    // points back to the constructor.

    // If this is not the same as Function.[[Prototype]], then this is definately inherited.
    // This is the case when in ES6 or when using __proto__ in a compatible browser.
    if (proto !== functionPrototype) {
        return proto;
    }

    // If the super prototype is Object.prototype, null, or undefined, then we cannot determine the heritage.
    const prototype = obj.prototype;
    const prototypeProto = prototype && Object.getPrototypeOf(prototype);
    // tslint:disable-next-line: triple-equals
    if (prototypeProto == undefined || prototypeProto === Object.prototype) {
        return proto;
    }

    // If the constructor was not a function, then we cannot determine the heritage.
    const constructor = prototypeProto.constructor;
    if (typeof constructor !== "function") {
        return proto;
    }

    // If we have some kind of self-reference, then we cannot determine the heritage.
    if (constructor === obj) {
        return proto;
    }

    // we have a pretty good guess at the heritage.
    return constructor;
}
/**
 * get metadata value of a metadata key on the prototype chain of an object and property
 * @param metadataKey metadata's key
 * @param target the target of metadataKey
 */
function recursiveGetMetadata(metadataKey: any, target: any, propertyKey?: string | symbol): any[] {
    // get metadata value of a metadata key on the prototype
    // let metadata = Reflect.getOwnMetadata(metadataKey, target, propertyKey);
    const metadata = IOCContainer.listPropertyData(metadataKey, target) || {};

    // get metadata value of a metadata key on the prototype chain
    let parent = ordinaryGetPrototypeOf(target);
    while (parent !== null) {
        // metadata = Reflect.getOwnMetadata(metadataKey, parent, propertyKey);
        const pmetadata = IOCContainer.listPropertyData(metadataKey, parent);
        if (pmetadata) {
            for (const n in pmetadata) {
                if (!metadata.hasOwnProperty(n)) {
                    metadata[n] = pmetadata[n];
                }
            }
        }
        parent = ordinaryGetPrototypeOf(parent);
    }
    return metadata;
}

/**
 * Marks a constructor method as to be autowired by Koatty"s dependency injection facilities.
 *
 * @export
 * @param {string} [identifier]
 * @param {CompomentType} [type]
 * @param {any[]} [constructArgs]
 * @param {boolean} [isDelay=false]
 * @returns {PropertyDecorator}
 */
export function Autowired(identifier?: string, type?: CompomentType, constructArgs?: any[], isDelay = false): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        const designType = Reflect.getMetadata("design:type", target, propertyKey);
        if (!identifier) {
            if (!designType || designType.name === "Object") {
                // throw Error("identifier cannot be empty when circular dependency exists");
                identifier = helper.camelCase(propertyKey, true);
            } else {
                identifier = designType.name;
            }
        }
        if (!identifier) {
            throw Error("identifier cannot be empty when circular dependency exists");
        }
        if (type === undefined) {
            if (identifier.indexOf("Controller") > -1) {
                type = "CONTROLLER";
            } else if (identifier.indexOf("Middleware") > -1) {
                type = "MIDDLEWARE";
            } else if (identifier.indexOf("Service") > -1) {
                type = "SERVICE";
            } else {
                type = "COMPONENT";
            }
        }
        //Cannot rely on injection controller
        if (type === "CONTROLLER") {
            throw new Error(`Controller cannot be injection!`);
        }
        //Cannot rely on injection middleware
        // if (type === "MIDDLEWARE") {
        //     throw new Error(`Middleware ${identifier || ""} cannot be injected!`);
        // }

        if (!designType || designType.name === "Object") {
            isDelay = true;
        }

        IOCContainer.savePropertyData(TAGGED_PROP, {
            type,
            identifier,
            delay: isDelay,
            args: constructArgs || []
        }, target, propertyKey);
    };
}

/**
 *
 *
 * @export
 * @param {*} target
 * @param {*} instance
 * @param {Container} container
 * @param {boolean} [isLazy=false]
 */
export function injectAutowired(target: any, instance: any, container: Container, isLazy = false) {
    const metaData = recursiveGetMetadata(TAGGED_PROP, target);

    // tslint:disable-next-line: forin
    for (const metaKey in metaData) {
        let dep;
        const { type, identifier, delay, args } = metaData[metaKey] || { type: "", identifier: "", delay: false, args: [] };
        if (type && identifier) {
            if (!delay || isLazy) {
                dep = container.get(identifier, type, args);
                if (dep) {
                    // tslint:disable-next-line: no-unused-expression
                    process.env.APP_DEBUG && logger.custom("think", "", `Register inject ${target.name} properties key: ${metaKey} => value: ${JSON.stringify(metaData[metaKey])}`);
                    Reflect.defineProperty(instance, metaKey, {
                        enumerable: true,
                        configurable: false,
                        writable: true,
                        value: dep
                    });
                } else {
                    throw new Error(`Component ${metaData[metaKey].identifier || ""} not found. It's autowired in class ${target.name}`);
                }
            } else {
                // Delay loading solves the problem of cyclic dependency
                const app = container.getApp();
                // tslint:disable-next-line: no-unused-expression
                app && app.once("appStart", () => {
                    // lazy inject autowired
                    injectAutowired(target, instance, container, true);
                });
            }
        }
    }
}
