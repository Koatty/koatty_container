/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 22:52:59
 * @LastEditTime: 2025-02-26 17:47:24
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { IAspect } from "../src/container/IContainer";
import { Aspect } from "../src/decorator/AOP";

@Aspect()
export class Test3Aspect implements IAspect {
  app: any;
  run(): Promise<any> {
    console.log("Test3Aspect");
    return Promise.resolve("Test3Aspect");
  }
} 