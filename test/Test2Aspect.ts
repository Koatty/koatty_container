/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 22:52:59
 * @LastEditTime: 2025-02-26 17:46:51
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { IAspect, AspectContext } from "../src/container/icontainer";
import { Aspect } from "../src/decorator/aop";

@Aspect()
export class Test2Aspect implements IAspect {
  app: any;
  
  async run(joinPoint: AspectContext): Promise<any> {
    console.log("Test2Aspect");
    return Promise.resolve("Test2Aspect");
  }
} 