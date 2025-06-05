/*
 * @Description: Invalid aspect classes for testing @Aspect decorator constraints
 * @Usage: Test @Aspect decorator validation
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Aspect } from "../src/decorator/AOP";

// 无效的切面类：没有 "Aspect" 后缀
export class InvalidName {
  run() {
    console.log("Invalid name aspect");
  }
}

// 无效的切面类：没有 run 方法（不使用装饰器，避免导入时报错）
export class InvalidMethodAspect {
  execute() {
    console.log("Invalid method aspect");
  }
}

// 有效的切面类：用于对比测试
@Aspect()
export class ValidTestAspect {
  run() {
    console.log("Valid test aspect");
  }
} 