/*
 * @Description: Parameter Modify Aspect for testing parameter modification
 * @Usage: Test parameter modification in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { IAspect, AspectContext } from "../src/container/icontainer";
import { Aspect } from "../src/decorator/aop";

@Aspect()
export class ParameterModifyAspect implements IAspect {
  app: any;
  
  async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
    console.log("Parameter Modify Before");
    // 修改参数
    const modifiedArgs = context.getArgs().map(arg => typeof arg === 'string' ? `Modified_${arg}` : arg);
    context.setArgs(modifiedArgs);
    
    if (proceed) {
      const result = await proceed();
      console.log("Parameter Modify After");
      return result;
    } else {
      console.log("Parameter Modify After");
      return modifiedArgs;
    }
  }
} 