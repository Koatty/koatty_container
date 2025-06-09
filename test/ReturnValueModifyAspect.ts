/*
 * @Description: Return value modification aspect for testing
 * @Usage: Test return value modification in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { IAspect } from "../src/container/icontainer";
import { Aspect } from "../src/decorator/aop";

@Aspect()
export class ReturnValueModifyAspect implements IAspect {
  app: any;
  
  async run(args: any[], proceed?: Function): Promise<any> {
    console.log("ReturnModify Before");
    
    let result;
    if (proceed) {
      // Around 类型
      result = await proceed(args);
      // 修改返回值：在字符串返回值前添加 "Return_" 前缀
      if (typeof result === 'string') {
        result = `Return_${result}`;
      }
    } else {
      // Before/After 类型，不修改返回值
      result = args;
    }
    
    console.log("ReturnModify After");
    return result;
  }
} 