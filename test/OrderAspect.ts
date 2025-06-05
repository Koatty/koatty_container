/*
 * @Description: Order testing aspect for AOP
 * @Usage: Test execution order in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Aspect } from "../src/decorator/AOP";

@Aspect()
export class OrderAspect {
  async run(args: any[], proceed?: Function): Promise<any> {
    // 从 args 中获取方法名（如果有的话）
    const methodName = args && args.length > 0 && typeof args[0] === 'string' ? args[0] : 'unknown';
    console.log(`Order Before: ${methodName}`);
    
    let result;
    if (proceed) {
      // Around 类型
      result = await proceed(args);
    } else {
      // Before/After 类型
      result = args;
    }
    
    console.log(`Order After: ${methodName}`);
    return result;
  }
} 