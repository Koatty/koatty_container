/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2022-02-18 14:29:10
 * @LastEditTime: 2022-02-18 14:51:12
 */
import * as helper from "koatty_lib";
import { Container } from "./Container";
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
export function injectProperty(target: any, instance: any, container?: Container) {
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