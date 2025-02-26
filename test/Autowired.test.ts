import assert from "assert";
import { IOC } from "../src/container/Container";
import { Autowired } from "../src/decorator/Autowired";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { ClassC } from "./ClassC";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { TestAspect } from "./TestAspect";

describe("Autowired", () => {
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

  // Autowired测试用例
  test("Autowired应注入正确实例", async () => {
    class TestService {
      run() { return "service_ok"; }
    }
    IOC.reg(TestService, { type: "SERVICE" });

    class TestClass {
      @Autowired()
      service!: TestService;
    }
    IOC.reg(TestClass);

    const ins = IOC.get(TestClass);
    expect(ins.service).toBeInstanceOf(TestService);
    expect(ins.service.run()).toBe("service_ok");
  });

  test("Autowired应自动推断组件类型", () => {
    class TestMiddleware {
      @Autowired()
      dep!: MyDependency;
    }

    expect(() => IOC.reg(TestMiddleware)).not.toThrow();
  });

  test("Autowired应拒绝注入Controller", () => {
    class InvalidController {
      dep!: any;
    }

    expect(() => Autowired(InvalidController)(InvalidController, 'dep')).toThrow();
  });

  test("Autowired应支持自定义标识符", async () => {
    const customId = "customDep";
    IOC.reg(customId, MyDependency);

    class CustomDepClass {
      @Autowired(customId)
      dep!: MyDependency;
    }
    IOC.reg(CustomDepClass);

    const ins = IOC.get(CustomDepClass);
    expect(ins.dep.run()).toBe("MyDependency.run");
  });

  // 新增Autowired测试用例
  test("Autowired with explicit name", async () => {
    const ins: ClassA = IOC.get("ClassA");
    assert.equal(ins.explicitDep?.run(), "MyDependency2.run");
  });

  test("Autowired type inference", async () => {
    const ins: ClassA = IOC.get("ClassA");
    assert(ins.inferredDep instanceof MyDependency);
  });

  test("Autowired with custom component type", async () => {
    class CustomService {
      @Autowired(undefined, "COMPONENT")
      dep: MyDependency;
    }
    IOC.reg(CustomService);
    const ins = IOC.get(CustomService);
    assert.equal(ins.dep.run(), "MyDependency.run");
  });


  test("Autowired不同作用域实例", async () => {
    class ScopedService {
      id = Math.random();
    }
    IOC.reg(ScopedService);

    class Consumer {
      @Autowired()
      service!: ScopedService;
    }
    IOC.reg(Consumer, { scope: "Prototype" });

    const ins1 = IOC.get(Consumer);
    const ins2 = IOC.get(Consumer);
    assert.notEqual(ins1, ins2);
    assert.equal(ins1.service.id, ins2.service.id);
    const ins3 = IOC.get(ScopedService);
    const ins4 = IOC.get(ScopedService);
    assert.equal(ins3, ins4);
  });

})
