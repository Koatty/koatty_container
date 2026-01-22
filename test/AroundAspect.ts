/*
 * @Description: Around testing aspect for AOP
 * @Usage: Test around execution in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { IAspect, AspectContext } from "../src/container/icontainer";
import { Aspect } from "../src/decorator/aop";

@Aspect()
export class AroundAspect implements IAspect {
  app: any;
  
  async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
    console.log("Around Before");
    if (proceed) {
      const result = await proceed();
      console.log("Around After");
      return result;
    }
    console.log("Around After");
    return context.getArgs();
  }
} 