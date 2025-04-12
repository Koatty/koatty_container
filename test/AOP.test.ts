import { IOC } from "../src/container/Container";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { ClassC } from "./ClassC";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { TestAspect } from "./TestAspect";


describe("AOP", () => {
  beforeAll(() => {
    IOC.reg(MyDependency);
    IOC.reg(MyDependency2);
    IOC.reg(TestAspect);
    IOC.reg(Test2Aspect);
    IOC.reg(Test3Aspect);
    IOC.reg("ClassA", ClassA);
    IOC.reg("ClassB", ClassB);
    IOC.reg("ClassC", ClassC);
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
    
    // 验证容器已清空
    const afterClear = IOC.get("ClassA");
    expect(afterClear).toBeNull();
    
    // 验证app引用仍然存在
    expect(IOC.getApp()).toBe(app);
    
    // 重新注册测试数据
    IOC.reg(MyDependency);
    IOC.reg(MyDependency2);
    IOC.reg(TestAspect);
    IOC.reg(Test2Aspect);
    IOC.reg(Test3Aspect);
    IOC.reg("ClassA", ClassA);
    IOC.reg("ClassB", ClassB);
    IOC.reg("ClassC", ClassC);
  })

})
