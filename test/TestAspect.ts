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

interface TestAspectArgs {
  event: string;
}

@Aspect()
export class TestAspect implements IAspect {
  app: any;
  run(args: TestAspectArgs[]): Promise<any> {
    const aa = ["aa", 1, "e"]
    console.log(args);
    return Promise.resolve();
  }
}