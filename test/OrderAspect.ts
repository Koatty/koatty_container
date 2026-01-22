/*
 * @Description: Order testing aspect for AOP
 * @Usage: Test execution order in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { IAspect, AspectContext } from "../src/container/icontainer";
import { Aspect } from "../src/decorator/aop";

@Aspect()
export class OrderAspect implements IAspect {
  app: any;
  
  async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
    // 输出传入的args参数，与TestAspect保持一致
    console.log(context.getArgs());
    
    let result;
    if (proceed) {
      // Around 类型 - Around会在前后都执行
      result = await proceed();
      // Around After阶段也输出args
      console.log(context.getArgs());
    } else {
      // Before/After 类型 - Before和After分别执行，只输出一次
      result = context.getArgs();
    }
    
    return result;
  }
} 