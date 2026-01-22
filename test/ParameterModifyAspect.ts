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
  
  async run(joinPoint: AspectContext): Promise<any> {
    console.log("Parameter Modify Before");
    // 修改参数
    const modifiedArgs = joinPoint.getArgs().map(arg => typeof arg === 'string' ? `Modified_${arg}` : arg);
    joinPoint.setArgs(modifiedArgs);
    
    if (joinPoint.hasProceed()) {
      const result = await joinPoint.executeProceed();
      console.log("Parameter Modify After");
      return result;
    } else {
      console.log("Parameter Modify After");
      return modifiedArgs;
    }
  }
} 