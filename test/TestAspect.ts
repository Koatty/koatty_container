/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 22:52:59
 * @LastEditTime: 2025-02-26 17:47:32
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { IAspect } from "../src/container/IContainer";
import { Aspect } from "../src/decorator/AOP";

@Aspect()
export class TestAspect implements IAspect {
  app: any;
  run(event: string): Promise<any> {
    console.log(event);
    return Promise.resolve();
  }
}