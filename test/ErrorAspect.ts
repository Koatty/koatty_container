/*
 * @Description: Error handling aspect for testing
 * @Usage: Test error handling in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Aspect } from "../src/decorator/AOP";

@Aspect()
export class ErrorAspect {
  async run(target: any, methodName: string, args: any[], proceed?: Function): Promise<any> {
    console.log(`Error Before: ${methodName}`);
    
    try {
      let result;
      if (proceed) {
        // Around 类型
        result = await proceed(args);
      } else {
        // Before/After 类型
        result = args;
      }
      
      console.log(`Error After: ${methodName}`);
      return result;
    } catch (error) {
      console.log(`Error Caught: ${methodName} - ${error.message}`);
      // 重新抛出异常
      throw error;
    }
  }
} 