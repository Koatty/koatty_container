/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2022-02-18 14:29:10
 * @LastEditTime: 2022-02-25 10:44:50
 */
import * as helper from "koatty_lib";
import { Container, IOCContainer } from "./Container";
import { TAGGED_ARGS } from "./IContainer";
import { RecursiveGetMetadata } from "./Util";

/**
 * Inject class instance property
 *
 * @export
 * @param {*} target
 * @param {*} instance
 * @param {Container} [container]
 */
export function injectValues(target: any, instance: any, container?: Container) {
    const metaData = RecursiveGetMetadata(TAGGED_ARGS, target);
    // tslint:disable-next-line: forin
    for (const metaKey in metaData) {
        const { name, method } = metaData[metaKey];
        Reflect.defineProperty(instance, name, {
            enumerable: true,
            configurable: false,
            writable: true,
            value: helper.isFunction(method) ? <Function>method() : (method ?? undefined),
        });
    }
}

/**
 * Indicates that an decorated class instance property values.
 *
 * @export
 * @param {any | Function} val
 * @param {unknown} [defaultValue]
 * @returns {*}  {PropertyDecorator}
 */
export function Values(val: any | Function, defaultValue?: unknown): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        const paramTypes = Reflect.getMetadata("design:type", target, propertyKey);
        const types = paramTypes.name ? paramTypes.name : "object";
        IOCContainer.savePropertyData(TAGGED_ARGS, {
            name: propertyKey,
            method: function () {
                let value = val;
                if (helper.isFunction(val)) {
                    value = val();
                }
                if (defaultValue !== undefined) {
                    value = helper.isTrueEmpty(value) ? defaultValue : value;
                }
                if (typeof value !== types) {
                    throw new Error("The type of the value is not the same as the type of the parameter");
                }
                return value;
            }
        }, target, propertyKey);
    };
}