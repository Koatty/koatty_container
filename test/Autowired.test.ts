import assert from "assert";
import { IOC } from "../src/container/Container";
import { Autowired } from "../src/decorator/Autowired";
import { Component } from "../src/decorator/Component";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { ClassC } from "./ClassC";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { TestAspect } from "./TestAspect";

describe("Autowired", () => {
  beforeEach(() => {
    IOC.clearInstances();
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
    @Component()
    class TestService {
      run() { return "service_ok"; }
    }
    IOC.reg(TestService, { type: "SERVICE" });

    @Component()
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
    @Component()
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

    // 测试直接调用装饰器应该抛出异常
    expect(() => {
      const decorator = Autowired();
      decorator(InvalidController.prototype, 'dep');
    }).toThrow();
  });

  test("Autowired应支持自定义标识符", async () => {
    // 使用MyDependency2作为自定义依赖，避免与已有的MyDependency冲突
    const customId = "MyDependency2"; // 直接使用已存在的标识符，避免camelCase转换和延迟加载
    
    @Component()
    class CustomDepClass {
      @Autowired(customId)
      dep!: MyDependency2; // 使用MyDependency2类型
    }
    
    // 创建模拟app对象来处理延迟加载
    const mockApp = {
      once: jest.fn((event: string, callback: Function) => {
        if (event === "appReady") {
          // 立即执行回调来模拟appReady事件
          setTimeout(callback, 0);
        }
      }),
      emit: jest.fn()
    };
    
    // 设置模拟app到容器中
    (<any>IOC).app = mockApp;
    
    IOC.reg(CustomDepClass);
    
    const ins = IOC.get(CustomDepClass);
    
    // 等待延迟加载完成
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(ins.dep).toBeInstanceOf(MyDependency2);
    expect(ins.dep.run()).toBe("MyDependency2.run");
    
    // 验证appReady事件被注册
    expect(mockApp.once).toHaveBeenCalledWith("appReady", expect.any(Function));
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
    @Component()
    class CustomService {
      @Autowired(undefined, "COMPONENT")
      dep: MyDependency;
    }
    IOC.reg(CustomService);
    const ins = IOC.get(CustomService);
    assert.equal(ins.dep.run(), "MyDependency.run");
  });


  test("Autowired不同作用域实例", async () => {
    @Component()
    class ScopedService {
      id = Math.random();
    }
    IOC.reg(ScopedService);

    @Component()
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
