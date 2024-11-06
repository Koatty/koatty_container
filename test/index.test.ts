import assert from "assert";
import { DefaultApp } from "../src/Application";
import { IOC } from "../src/Container";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { ClassC } from "./ClassC";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { TestAspect } from "./TestAspect";

describe("IOC", () => {
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

  test("SetOrGetApp", () => {
    const app = new DefaultApp();
    app.env = "production";
    IOC.setApp(app);

    assert.equal(IOC.getApp().env, "production")
  })

  test("getInsByClass", async () => {
    const ins = IOC.getInsByClass(ClassA);
    expect(ins).toBeInstanceOf(ClassA);
  })

  test("getIdentifier", async () => {
    const id = IOC.getIdentifier(ClassA)
    assert.equal(id, "ClassA")
  })

  test("getType", async () => {
    const id = IOC.getType(ClassA)
    assert.equal(id, "COMPONENT")
  })

  test("Autowired", async () => {
    const ins: ClassA = IOC.get("ClassA");
    assert.equal(await ins.run(), "MyDependency.run");
  })

  test("Inject", async () => {
    const ins: ClassB = IOC.get("ClassB");
    assert.equal(await ins.run(), "MyDependency2.run");
  })

  test("Extends", async () => {
    const ins: ClassC = IOC.get("ClassC");
    assert.equal(await ins.run(), "MyDependency.run");
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

})