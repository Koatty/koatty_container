/*
 * @Description: Around testing aspect for AOP
 * @Usage: Test around execution in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Aspect } from "../src/decorator/AOP";

@Aspect()
export class AroundAspect {
  async run(args: any[], proceed: Function): Promise<any> {
    console.log("Around Before");
    const result = await proceed(args);
    console.log("Around After");
    return result;
  }
} 