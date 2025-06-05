/*
 * @Description: Test class for Around AOP functionality
 * @Usage: Test Around and AroundEach decorators
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Around, AroundEach } from "../src/decorator/AOP";
import { AroundAspect } from "./AroundAspect";

@AroundEach(AroundAspect)
export class ClassD {
  name: string;
  
  constructor() {
    this.name = "ClassD.name";
  }

  // 这个方法会被AroundEach装饰器影响
  async normalMethod(input: string): Promise<string> {
    return `Normal: ${input}`;
  }

  // 这个方法有自己的Around装饰器
  @Around(AroundAspect)
  async specificMethod(input: string): Promise<string> {
    return `Specific: ${input}`;
  }

  // 测试无参数方法
  async noParamMethod(): Promise<string> {
    return "NoParam";
  }

  // 测试异常处理
  async errorMethod(): Promise<string> {
    throw new Error("Test error");
  }

  // 测试非异步方法
  syncMethod(input: string): string {
    return `Sync: ${input}`;
  }
} 