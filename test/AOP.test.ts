import { IOC } from "../src/container/Container";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { ClassC } from "./ClassC";
import { ClassD } from "./ClassD";
import { ClassE } from "./ClassE";
import { ClassF, ClassFWithEach, ClassG } from "./ClassF";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { TestAspect } from "./TestAspect";
import { AroundAspect } from "./AroundAspect";
import { ParameterModifyAspect } from "./ParameterModifyAspect";
import { ReturnValueModifyAspect } from "./ReturnValueModifyAspect";
import { ErrorAspect } from "./ErrorAspect";
import { OrderAspect } from "./OrderAspect";
import { InvalidName, InvalidMethodAspect, ValidTestAspect } from "./InvalidAspect";
import { Aspect } from "../src/decorator/AOP";


describe("AOP", () => {
  beforeAll(() => {
    IOC.reg(MyDependency);
    IOC.reg(MyDependency2);
    IOC.reg(TestAspect);
    IOC.reg(Test2Aspect);
    IOC.reg(Test3Aspect);
    IOC.reg(AroundAspect);
    IOC.reg(ParameterModifyAspect);
    IOC.reg(ReturnValueModifyAspect);
    IOC.reg(ErrorAspect);
    IOC.reg(OrderAspect);
    IOC.reg(ValidTestAspect);
    IOC.reg("ClassA", ClassA);
    IOC.reg("ClassB", ClassB);
    IOC.reg("ClassC", ClassC);
    IOC.reg("ClassD", ClassD);
    IOC.reg("ClassE", ClassE);
    IOC.reg("ClassF", ClassF);
    IOC.reg("ClassFWithEach", ClassFWithEach);
    IOC.reg("ClassG", ClassG);
  })

  beforeEach(() => {
    IOC.clearInstances(); // Only clear instances, keep metadata
  })

  test("Before", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassC = IOC.get("ClassC");
    await ins.run2("Before");
    // 断言 console.log 被正确调用并输出预期内容
    expect(logSpy).toHaveBeenCalledWith("Before");
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })
  test("After", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassC = IOC.get("ClassC");
    await ins.run3("After");
    // 断言 console.log 被正确调用并输出预期内容
    expect(logSpy).toHaveBeenCalledWith("After");
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("BeforeEach", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassB = IOC.get("ClassB");
    await ins.run();
    // 断言 console.log 被正确调用并输出预期内容
    expect(logSpy).toHaveBeenCalledWith("Test2Aspect");
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })
  test("AfterEach", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassA = IOC.get("ClassA");
    await ins.run();
    // 断言 console.log 被正确调用并输出预期内容
    expect(logSpy).toHaveBeenCalledWith("Test3Aspect");
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("Around", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassD = IOC.get("ClassD");
    const result = await ins.specificMethod("test");
    
    // specificMethod同时受到@AroundEach和@Around影响，所以AroundAspect会执行两次
    // 第一次：@AroundEach(AroundAspect) - 类级别
    // 第二次：@Around(AroundAspect) - 方法级别
    // 预期结果：参数被修改两次，返回值被包装两次
    expect(logSpy).toHaveBeenCalledWith("Around Before: specificMethod");
    expect(logSpy).toHaveBeenCalledWith("Around After: specificMethod");
    expect(result).toBe("Wrapped_Wrapped_Specific: Modified_Modified_test");
    
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("AroundEach", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassD = IOC.get("ClassD");
    const result = await ins.normalMethod("test");
    
    // normalMethod只受到@AroundEach影响，所以AroundAspect只执行一次
    expect(logSpy).toHaveBeenCalledWith("Around Before: normalMethod");
    expect(logSpy).toHaveBeenCalledWith("Around After: normalMethod");
    expect(result).toBe("Wrapped_Normal: Modified_test");
    
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("Around Error Handling", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassD = IOC.get("ClassD");
    
    // errorMethod受到@AroundEach影响，测试异常处理
    await expect(ins.errorMethod()).rejects.toThrow("Test error");
    expect(logSpy).toHaveBeenCalledWith("Around Before: errorMethod");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Around Error: errorMethod"));
    
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("Around No Parameters", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassD = IOC.get("ClassD");
    const result = await ins.noParamMethod();
    
    // noParamMethod只受到@AroundEach影响，验证无参数方法的Around处理
    expect(logSpy).toHaveBeenCalledWith("Around Before: noParamMethod");
    expect(logSpy).toHaveBeenCalledWith("Around After: noParamMethod");
    expect(result).toBe("Wrapped_NoParam");
    
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("Around Sync Method", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassD = IOC.get("ClassD");
    const result = await ins.syncMethod("test");
    
    // syncMethod只受到@AroundEach影响，验证同步方法的Around处理
    expect(logSpy).toHaveBeenCalledWith("Around Before: syncMethod");
    expect(logSpy).toHaveBeenCalledWith("Around After: syncMethod");
    expect(result).toBe("Wrapped_Sync: Modified_test");
    
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("DefaultBeforeEach", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassC = IOC.get("ClassC");
    await ins.run();
    // 断言 console.log 被正确调用并输出预期内容
    expect(logSpy).toHaveBeenCalledWith("__before");
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("DefaultAfterEach", async () => {
    // 使用 jest.spyOn 来监控 console.log
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassC = IOC.get("ClassC");
    await ins.run();
    // 断言 console.log 被正确调用并输出预期内容
    expect(logSpy).toHaveBeenCalledWith("__after");
    // 恢复 spy 的原始功能
    logSpy.mockRestore();
  })

  test("ClearContainer", async () => {
    // 保存app引用
    const app = IOC.getApp();
    
    // 验证容器中有数据
    const beforeClear = IOC.get("ClassA");
    expect(beforeClear).toBeDefined();
    
    // 执行clear
    IOC.clear();
    
    // 验证容器已清空 - 应该抛出异常而不是返回null
    expect(() => {
      IOC.get("ClassA");
    }).toThrow("Bean ClassA not found");
    
    // 验证app引用仍然存在
    expect(IOC.getApp()).toBe(app);
    
    // 重新注册测试数据
    IOC.reg(MyDependency);
    IOC.reg(MyDependency2);
    IOC.reg(TestAspect);
    IOC.reg(Test2Aspect);
    IOC.reg(Test3Aspect);
    IOC.reg(AroundAspect);
    IOC.reg(ParameterModifyAspect);
    IOC.reg(ReturnValueModifyAspect);
    IOC.reg(ErrorAspect);
    IOC.reg(OrderAspect);
    IOC.reg(ValidTestAspect);
    IOC.reg("ClassA", ClassA);
    IOC.reg("ClassB", ClassB);
    IOC.reg("ClassC", ClassC);
    IOC.reg("ClassD", ClassD);
    IOC.reg("ClassE", ClassE);
    IOC.reg("ClassF", ClassF);
    IOC.reg("ClassFWithEach", ClassFWithEach);
    IOC.reg("ClassG", ClassG);
  })

  test("Multiple Decorators Combination", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    const result = await ins.multipleDecoratorsMethod("test");
    
    // 验证执行顺序：BeforeEach -> Before -> Around -> After -> AfterEach
    expect(logSpy).toHaveBeenCalledWith("Order Before: multipleDecoratorsMethod");
    expect(logSpy).toHaveBeenCalledWith("Before");
    expect(logSpy).toHaveBeenCalledWith("ParamModify Before: multipleDecoratorsMethod");
    expect(logSpy).toHaveBeenCalledWith("ParamModify After: multipleDecoratorsMethod");
    expect(logSpy).toHaveBeenCalledWith("After");
    expect(logSpy).toHaveBeenCalledWith("Order After: multipleDecoratorsMethod");
    
    // 验证参数被修改
    expect(result).toBe("Multiple: Param_test");
    
    logSpy.mockRestore();
  })

  test("Parameter Modification Chain", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    const result = await ins.parameterChainMethod("test");
    
    // 验证多个Around装饰器的执行
    expect(logSpy).toHaveBeenCalledWith("ParamModify Before: parameterChainMethod");
    expect(logSpy).toHaveBeenCalledWith("ReturnModify Before: parameterChainMethod");
    expect(logSpy).toHaveBeenCalledWith("ReturnModify After: parameterChainMethod");
    expect(logSpy).toHaveBeenCalledWith("ParamModify After: parameterChainMethod");
    
    // 验证参数和返回值都被修改
    expect(result).toBe("Return_Chain: Param_test");
    
    logSpy.mockRestore();
  })

  test("Class Level and Method Level Conflict", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    const result = await ins.conflictMethod("test");
    
    // 验证BeforeEach和Before都执行
    expect(logSpy).toHaveBeenCalledWith("Order Before: conflictMethod");
    expect(logSpy).toHaveBeenCalledWith("Before");
    expect(logSpy).toHaveBeenCalledWith("After");
    expect(logSpy).toHaveBeenCalledWith("Order After: conflictMethod");
    
    expect(result).toBe("Conflict: test");
    
    logSpy.mockRestore();
  })

  test("Exception Handling in AOP", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    
    await expect(ins.exceptionMethod()).rejects.toThrow("Test exception in ClassE");
    
    // 验证异常被正确捕获和传播
    expect(logSpy).toHaveBeenCalledWith("Error Before: exceptionMethod");
    expect(logSpy).toHaveBeenCalledWith("Error Caught: exceptionMethod - Test exception in ClassE");
    
    logSpy.mockRestore();
  })

  test("Multiple Same Type Decorators", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    const result = await ins.multipleSameTypeMethod("test");
    
    // 验证多个Before装饰器都执行
    expect(logSpy).toHaveBeenCalledWith("Before");
    expect(logSpy).toHaveBeenCalledWith("Order Before: unknown");
    
    expect(result).toBe("SameType: test");
    
    logSpy.mockRestore();
  })

  test("Return Value Modification", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    const result = await ins.returnModifyMethod("test");
    
    // 验证返回值被修改
    expect(logSpy).toHaveBeenCalledWith("ReturnModify Before: returnModifyMethod");
    expect(logSpy).toHaveBeenCalledWith("ReturnModify After: returnModifyMethod");
    expect(result).toBe("Return_Original: test");
    
    logSpy.mockRestore();
  })

  test("Class Level Decorators Only", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    const result = await ins.normalMethod("test");
    
    // 验证只有类级别装饰器执行
    expect(logSpy).toHaveBeenCalledWith("Order Before: unknown");
    expect(logSpy).toHaveBeenCalledWith("Order After: unknown");
    expect(result).toBe("Normal: test");
    
    logSpy.mockRestore();
  })

  test("Aspect Decorator Validation - Invalid Name", () => {
    // 测试没有Aspect后缀的类
    expect(() => {
      @Aspect()
      class InvalidName {
        run() {}
      }
    }).toThrow("Aspect class names must use a suffix `Aspect`.");
  })

  test("Aspect Decorator Validation - Missing Run Method", () => {
    // 测试没有run方法的类
    expect(() => {
      @Aspect()
      class MissingRunAspect {
        execute() {}
      }
    }).toThrow("The aspect class must implement the `run` method.");
  })

  test("Aspect Decorator Validation - Valid Aspect", () => {
    // 测试有效的切面类
    expect(() => {
      @Aspect()
      class ValidAspect {
        run() {}
      }
    }).not.toThrow();
  })

  test("AOP Execution Order Verification", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassE = IOC.get("ClassE");
    
    // 清除之前的调用记录
    logSpy.mockClear();
    
    await ins.multipleDecoratorsMethod("order");
    
    // 获取所有的日志调用
    const calls = logSpy.mock.calls.map(call => call[0]);
    
    // 验证执行顺序
    const expectedOrder = [
      "Order Before: unknown",  // BeforeEach (简化参数后无法获取方法名)
      "Before",                 // Before
      "Parameter Modify Before", // Around start
      "Parameter Modify After",  // Around end
      "After",                  // After
      "Order After: unknown"    // AfterEach
    ];
    
    expectedOrder.forEach((expected, index) => {
      expect(calls[index]).toBe(expected);
    });
    
    logSpy.mockRestore();
  })

  test("Built-in Aspect Methods Priority with Around", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassF = IOC.get("ClassF");
    
    // 清除之前的调用记录
    logSpy.mockClear();
    
    const result = await ins.methodWithAround("test");
    
    // 获取所有的日志调用
    const calls = logSpy.mock.calls.map(call => call[0]);
    
    // 验证执行顺序：__before -> Around Before -> Original -> Around After -> __after
    const expectedOrder = [
      "__before: highest priority",  // 内置切面方法最先执行
      "Around Before",               // Around装饰器开始
      "Original method execution",   // 原始方法
      "Around After",                // Around装饰器结束
      "__after: highest priority"    // 内置切面方法最后执行
    ];
    
    expectedOrder.forEach((expected, index) => {
      expect(calls[index]).toBe(expected);
    });
    
    expect(result).toBe("Modified_Method: test");
    
    logSpy.mockRestore();
  })

  test("Built-in Aspect Methods Priority with Multiple Decorators", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassF = IOC.get("ClassF");
    
    // 清除之前的调用记录
    logSpy.mockClear();
    
    const result = await ins.methodWithMultipleDecorators("test");
    
    // 获取所有的日志调用
    const calls = logSpy.mock.calls.map(call => call[0]);
    
    // 验证执行顺序：__before -> @Before -> @Around -> @After -> __after
    const expectedOrder = [
      "__before: highest priority",      // 内置切面方法最先执行
      "test",                            // @Before装饰器（TestAspect输出event参数）
      "Around Before",                   // @Around装饰器开始
      "Original method with multiple decorators", // 原始方法
      "Around After",                    // @Around装饰器结束
      "test",                            // @After装饰器（TestAspect输出event参数）
      "__after: highest priority"       // 内置切面方法最后执行
    ];
    
    expectedOrder.forEach((expected, index) => {
      expect(calls[index]).toBe(expected);
    });
    
    expect(result).toBe("Modified_Multiple: test");
    
    logSpy.mockRestore();
  })

  test("Built-in Aspect Methods Only", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassF = IOC.get("ClassF");
    
    // 清除之前的调用记录
    logSpy.mockClear();
    
    const result = await ins.normalMethodWithBuiltIn("test");
    
    // 获取所有的日志调用
    const calls = logSpy.mock.calls.map(call => call[0]);
    
    // 验证执行顺序：__before -> Original -> __after
    const expectedOrder = [
      "__before: highest priority",    // 内置切面方法最先执行
      "Normal method execution",       // 原始方法
      "__after: highest priority"     // 内置切面方法最后执行
    ];
    
    expectedOrder.forEach((expected, index) => {
      expect(calls[index]).toBe(expected);
    });
    
    expect(result).toBe("Normal: test");
    
    logSpy.mockRestore();
  })

  test("Built-in Aspect Methods Mutual Exclusion with BeforeEach/AfterEach", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassFWithEach = IOC.get("ClassFWithEach");
    
    // 清除之前的调用记录
    logSpy.mockClear();
    
    const result = await ins.testMethod("test");
    
    // 获取所有的日志调用
    const calls = logSpy.mock.calls.map(call => call[0]);
    
    // 验证执行顺序：由于有内置切面方法，@BeforeEach/@AfterEach应该被抑制
    const expectedOrder = [
      "__before: should suppress BeforeEach",  // 内置切面方法执行
      "Test method with built-in and Each decorators", // 原始方法
      "__after: should suppress AfterEach"     // 内置切面方法执行
    ];
    
    expectedOrder.forEach((expected, index) => {
      expect(calls[index]).toBe(expected);
    });
    
    // 验证 @BeforeEach/@AfterEach 没有执行
    expect(calls).not.toContain("Test2Aspect");
    expect(calls).not.toContain("Test3Aspect");
    
    expect(result).toBe("Test: test");
    
    logSpy.mockRestore();
  })

  test("BeforeEach/AfterEach Execute When No Built-in Methods", async () => {
    const logSpy = jest.spyOn(console, 'log');
    const ins: ClassG = IOC.get("ClassG");
    
    // 清除之前的调用记录
    logSpy.mockClear();
    
    const result = await ins.methodWithEachDecorators("test");
    
    // 获取所有的日志调用
    const calls = logSpy.mock.calls.map(call => call[0]);
    
    // 验证执行顺序：没有内置切面方法，@BeforeEach/@AfterEach应该正常执行
    const expectedOrder = [
      "Test2Aspect",                           // @BeforeEach 执行
      "Method with Each decorators (no built-in)", // 原始方法
      "Test3Aspect"                            // @AfterEach 执行
    ];
    
    expectedOrder.forEach((expected, index) => {
      expect(calls[index]).toBe(expected);
    });
    
    expect(result).toBe("Each: test");
    
    logSpy.mockRestore();
  })

})
