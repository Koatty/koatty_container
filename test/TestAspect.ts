/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 22:52:59
 * @LastEditTime: 2025-02-26 17:47:32
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { IAspect, AspectContext } from "../src/container/icontainer";
import { Aspect } from "../src/decorator/aop";

@Aspect()
export class TestAspect implements IAspect {
  app: any;
  
  async run(joinPoint: AspectContext): Promise<any> {
    // TestAspect输出接收的参数数组
    console.log(joinPoint.getArgs());
    
    // 如果有proceed函数（Around类型），需要调用它来继续执行链
    if (joinPoint.hasProceed()) {
      return await joinPoint.executeProceed();
    }
    
    // 对于Before/After类型，不需要返回值
    return Promise.resolve();
  }
}