/*
 * @Description: App interface
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 13:07:04
 * @LastEditTime: 2024-11-05 13:07:30
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
/**
 * Base Application
 *
 * @export
 * @interface Application
 */
export interface Application {
  env: string;
  options: object;

  /**
   * event
   * @param event 
   * @param callback 
   */
  on(event: string, callback: () => void): any;
  once(event: string, callback: () => void): any;
  /**
  * app metadata
  *
  * @memberof Application
  */
  getMetaData: (key: string) => unknown;
  setMetaData: (key: string, value: unknown) => void;
}