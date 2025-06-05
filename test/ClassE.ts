/*
 * @Description: Test class for multiple AOP decorators combination
 * @Usage: Test various AOP decorator combinations and execution order
 * @Author: richen
 * @Date: 2025-01-XX XX:XX:XX
 * @LastEditTime: 2025-01-XX XX:XX:XX
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Before, After, Around, BeforeEach, AfterEach } from "../src/decorator/AOP";
import { ParameterModifyAspect } from "./ParameterModifyAspect";
import { ReturnValueModifyAspect } from "./ReturnValueModifyAspect";
import { ErrorAspect } from "./ErrorAspect";
import { OrderAspect } from "./OrderAspect";
import { TestAspect } from "./TestAspect";

@BeforeEach(OrderAspect)
@AfterEach(OrderAspect)
export class ClassE {
  name: string;
  
  constructor() {
    this.name = "ClassE.name";
  }

  // 测试多个装饰器组合：Before + Around + After
  @Before(TestAspect)
  @Around(ParameterModifyAspect)
  @After(TestAspect)
  async multipleDecoratorsMethod(input: string): Promise<string> {
    return `Multiple: ${input}`;
  }

  // 测试参数修改链：多个Around装饰器
  @Around(ParameterModifyAspect)
  @Around(ReturnValueModifyAspect)
  async parameterChainMethod(input: string): Promise<string> {
    return `Chain: ${input}`;
  }

  // 测试类级别和方法级别装饰器冲突
  @Before(TestAspect)
  async conflictMethod(input: string): Promise<string> {
    return `Conflict: ${input}`;
  }

  // 测试异常处理
  @Around(ErrorAspect)
  async exceptionMethod(): Promise<string> {
    throw new Error("Test exception in ClassE");
  }

  // 测试多个相同类型装饰器
  @Before(TestAspect)
  @Before(OrderAspect)
  async multipleSameTypeMethod(input: string): Promise<string> {
    return `SameType: ${input}`;
  }

  // 测试返回值修改
  @Around(ReturnValueModifyAspect)
  async returnModifyMethod(input: string): Promise<string> {
    return `Original: ${input}`;
  }

  // 普通方法，只受类级别装饰器影响
  async normalMethod(input: string): Promise<string> {
    return `Normal: ${input}`;
  }
} 