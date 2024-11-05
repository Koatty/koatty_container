/*
 * @Description: App
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 12:57:19
 * @LastEditTime: 2024-11-05 13:06:14
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { EventEmitter } from "stream";
import { Application } from "./IApp";

export class DefaultApp extends EventEmitter implements Application {
  env: string = "developer";
  options: object;

  private metadata = new Map();

  /**
   * get metadata
   * @param key 
   * @returns 
   */
  getMetaData(key: string) {
    return this.metadata.get(key);
  };

  /**
   * set metadata
   * @param key 
   * @param value 
   */
  setMetaData(key: string, value: unknown) {
    value = Array.isArray(value) ? value : [value];
    this.metadata.set(key, value);
  };

}