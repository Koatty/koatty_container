/*
 * @Description: Order testing aspect for AOP
 * @Usage: Test execution order in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { IAspect } from "../src/container/icontainer";
import { Aspect } from "../src/decorator/aop";

@Aspect()
export class OrderAspect implements IAspect {
  app: any;
  
  async run(args: any[], proceed?: Function): Promise<any> {
    // 输出传入的args参数，与TestAspect保持一致
    console.log(args);
    
    let result;
    if (proceed) {
      // Around 类型 - Around会在前后都执行
      result = await proceed(args);
      // Around After阶段也输出args
      console.log(args);
    } else {
      // Before/After 类型 - Before和After分别执行，只输出一次
      result = args;
    }
    
    return result;
  }
} 