/*
 * @Description: Parameter Modify Aspect for testing parameter modification
 * @Usage: Test parameter modification in AOP
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Aspect } from "../src/decorator/AOP";

@Aspect()
export class ParameterModifyAspect {
  async run(args: any[], proceed: Function): Promise<any> {
    console.log("Parameter Modify Before");
    // 修改参数
    const modifiedArgs = args.map(arg => typeof arg === 'string' ? `Modified_${arg}` : arg);
    const result = await proceed(modifiedArgs);
    console.log("Parameter Modify After");
    return result;
  }
} 