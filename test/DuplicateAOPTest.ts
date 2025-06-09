/*
 * @Description: Test class for duplicate AOP decorators override functionality
 * @Usage: Test that later decorators override earlier ones of the same type
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Before, After, Around, BeforeEach, AfterEach, AroundEach } from "../src/decorator/aop";
import { TestAspect } from "./TestAspect";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { AroundAspect } from "./AroundAspect";

// 测试方法级别重复装饰器覆盖
export class DuplicateMethodLevelTest {
  name: string;
  
  constructor() {
    this.name = "DuplicateMethodLevelTest.name";
  }

  // 测试重复的@Before装饰器，最后一个Test2Aspect应该生效
  @Before(TestAspect)      // 这个会被覆盖
  @Before(Test2Aspect)     // 这个生效
  async duplicateBeforeMethod(input: string): Promise<string> {
    return `Before: ${input}`;
  }

  // 测试重复的@After装饰器，最后一个Test3Aspect应该生效
  @After(TestAspect)       // 这个会被覆盖
  @After(Test3Aspect)      // 这个生效
  async duplicateAfterMethod(input: string): Promise<string> {
    return `After: ${input}`;
  }

  // 测试重复的@Around装饰器，最后一个AroundAspect应该生效
  @Around(TestAspect)      // 这个会被覆盖（虽然TestAspect不是Around类型，但为了测试）
  @Around(AroundAspect)    // 这个生效
  async duplicateAroundMethod(input: string): Promise<string> {
    return `Around: ${input}`;
  }

  // 测试混合不同类型装饰器（不会相互覆盖）
  @Before(TestAspect)
  @After(Test3Aspect)
  @Around(AroundAspect)
  async mixedTypesMethod(input: string): Promise<string> {
    return `Mixed: ${input}`;
  }
}

// 测试类级别重复装饰器覆盖
@BeforeEach(TestAspect)    // 这个会被覆盖
@BeforeEach(Test2Aspect)   // 这个生效
@AfterEach(TestAspect)     // 这个会被覆盖
@AfterEach(Test3Aspect)    // 这个生效
@AroundEach(TestAspect)    // 这个会被覆盖（虽然TestAspect不是Around类型，但为了测试）
@AroundEach(AroundAspect)  // 这个生效
export class DuplicateClassLevelTest {
  name: string;
  
  constructor() {
    this.name = "DuplicateClassLevelTest.name";
  }

  async testMethod(input: string): Promise<string> {
    return `Class: ${input}`;
  }

  async anotherMethod(input: string): Promise<string> {
    return `Another: ${input}`;
  }
}

// 测试方法级别和类级别装饰器的优先级（方法级别优先）
@BeforeEach(TestAspect)    // 类级别
export class PriorityTest {
  name: string;
  
  constructor() {
    this.name = "PriorityTest.name";
  }

  // 方法级别的@Before应该覆盖类级别的@BeforeEach
  @Before(Test2Aspect)     // 方法级别，优先级更高
  async methodWithPriority(input: string): Promise<string> {
    return `Priority: ${input}`;
  }

  // 只有类级别的@BeforeEach生效
  async normalMethod(input: string): Promise<string> {
    return `Normal: ${input}`;
  }
} 