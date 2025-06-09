/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2025-06-09 11:19:30
 */

import EventEmitter from "events";

/**
 * Application interface for the container.
 * Defines the basic structure and capabilities of an application.
 * 
 * @interface Application
 */
export interface Application {
  env?: string;
  options?: object;

  use?: Function;
  config?: Function;

  /**
   * event
   * @param event 
   * @param callback 
   */
  on?: (event: string, callback: () => void) => any;
  once?: (event: string, callback: () => void) => any;
  /**
  * app metadata
  *
  * @memberof Application
  */
  getMetaData: (key: string) => unknown;
  setMetaData: (key: string, value: unknown) => void;
}

/**
 * Application class
 * @extends EventEmitter
 * @implements Application
 */
export class App extends EventEmitter implements Application {
  env: string = 'production';
  options: object = {};
  use: Function = () => {};
  config: Function = () => {};
  
  getMetaData: (key: string) => unknown = () => {};
  setMetaData: (key: string, value: unknown) => void = () => {};
}