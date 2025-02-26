/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 22:52:59
 * @LastEditTime: 2024-11-05 23:42:15
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { Aspect } from "../src/AOP";
import { IAspect } from "../src/IContainer";

@Aspect()
export class Test3Aspect implements IAspect {
  app: any;
  run(): Promise<any> {
    console.log("Test3Aspect");
    return Promise.resolve("Test3Aspect");
  }
} 