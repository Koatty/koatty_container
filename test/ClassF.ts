/*
 * @Description: Test class for built-in aspect methods priority
 * @Usage: Test __before and __after priority over @Around decorators
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Around, Before, After, BeforeEach, AfterEach } from "../src/decorator/AOP";
import { AroundAspect } from "./AroundAspect";
import { TestAspect } from "./TestAspect";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";

export class ClassF {
  name: string;
  
  constructor() {
    this.name = "ClassF.name";
  }

  // 内置切面方法，优先级最高
  __before() {
    console.log("__before: highest priority");
  }

  __after() {
    console.log("__after: highest priority");
  }

  // 测试内置切面方法与@Around装饰器的优先级
  @Around(AroundAspect)
  async methodWithAround(input: string): Promise<string> {
    console.log("Original method execution");
    return `Method: ${input}`;
  }

  // 测试内置切面方法与多个装饰器的优先级
  @Before(TestAspect)
  @Around(AroundAspect)
  @After(TestAspect)
  async methodWithMultipleDecorators(input: string): Promise<string> {
    console.log("Original method with multiple decorators");
    return `Multiple: ${input}`;
  }

  // 普通方法，只有内置切面方法
  async normalMethodWithBuiltIn(input: string): Promise<string> {
    console.log("Normal method execution");
    return `Normal: ${input}`;
  }

  // 测试内置切面方法与类级别装饰器的互斥关系
  async methodWithClassLevelDecorators(input: string): Promise<string> {
    console.log("Method with class-level decorators");
    return `ClassLevel: ${input}`;
  }
}

// 创建一个有内置切面方法且有@BeforeEach/@AfterEach的类，用于测试互斥关系
@BeforeEach(Test2Aspect)
@AfterEach(Test3Aspect)
export class ClassFWithEach {
  name: string;
  
  constructor() {
    this.name = "ClassFWithEach.name";
  }

  // 内置切面方法，应该与@BeforeEach/@AfterEach互斥
  __before() {
    console.log("__before: should suppress BeforeEach");
  }

  __after() {
    console.log("__after: should suppress AfterEach");
  }

  async testMethod(input: string): Promise<string> {
    console.log("Test method with built-in and Each decorators");
    return `Test: ${input}`;
  }
}

// 创建一个没有内置切面方法的类，用于对比测试
@BeforeEach(Test2Aspect)
@AfterEach(Test3Aspect)
export class ClassG {
  name: string;
  
  constructor() {
    this.name = "ClassG.name";
  }

  // 没有内置切面方法，@BeforeEach/@AfterEach应该正常执行
  async methodWithEachDecorators(input: string): Promise<string> {
    console.log("Method with Each decorators (no built-in)");
    return `Each: ${input}`;
  }
} 