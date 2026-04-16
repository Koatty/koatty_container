import assert from "assert";
import { IOC } from "../src/container/container";
import { Autowired, Inject } from "../src/decorator/autowired";
import { Component } from "./helpers/decorators";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { ClassC } from "./ClassC";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { TestAspect } from "./TestAspect";
import "reflect-metadata";

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
    // 使用自定义标识符注册MyDependency2
    const customId = "CustomMyDependency2";
    
    @Component()
    class CustomDepClass {
      @Autowired(customId)
      dep!: MyDependency2;
    }
    
    // 使用自定义标识符注册MyDependency2
    IOC.reg(customId, MyDependency2);
    IOC.reg(CustomDepClass);
    
    const ins = IOC.get(CustomDepClass);
    
    // 验证依赖注入成功
    expect(ins.dep).toBeInstanceOf(MyDependency2);
    expect(ins.dep.run()).toBe("MyDependency2.run");
    
    // 同时验证可以通过自定义标识符直接获取
    const depByCustomId = IOC.get(customId);
    expect(depByCustomId).toBeInstanceOf(MyDependency2);
    expect(depByCustomId).toBe(ins.dep); // 应该是同一个实例（单例）
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

  test("should throw error for Controller injection", () => {
    expect(() => {
      @Component()
      class TestClass {
        @Autowired("TestController", "CONTROLLER")
        controller: any;
      }
    }).toThrow("Controller bean cannot be injection!");
  });

  describe("Explicit class type parameter", () => {
    test("should inject using explicit class type without design:type", () => {
      const originalGetMetadata = Reflect.getMetadata;
      const getMetadataSpy = jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: object, propertyKey: string | symbol) => {
        if (key === "design:type") return undefined;
        return originalGetMetadata.call(Reflect, key, target, propertyKey);
      });

      @Component()
      class ExplicitService {
        run() { return "explicit_ok"; }
      }
      IOC.reg(ExplicitService);

      @Component()
      class ConsumerWithExplicitType {
        @Autowired(ExplicitService)
        service!: ExplicitService;
      }
      IOC.reg(ConsumerWithExplicitType);

      const ins = IOC.get(ConsumerWithExplicitType);
      expect(ins.service).toBeInstanceOf(ExplicitService);
      expect(ins.service.run()).toBe("explicit_ok");

      getMetadataSpy.mockRestore();
    });

    test("should set delay=false when explicit class type is provided", () => {
      const savePropertyDataSpy = jest.spyOn(IOC, 'savePropertyData');

      @Component()
      class DelayTestService {}

      @Component()
      class DelayTestConsumer {
        @Autowired(DelayTestService)
        service!: DelayTestService;
      }

      const calls = savePropertyDataSpy.mock.calls;
      const relevantCall = calls.find(c => c[3] === 'service' && c[2] === DelayTestConsumer.prototype);
      expect(relevantCall).toBeDefined();
      expect(relevantCall![1].delay).toBe(false);

      savePropertyDataSpy.mockRestore();
    });

    test("should fall back to design:type when paramName is not provided", () => {
      @Component()
      class FallbackService {
        run() { return "fallback_ok"; }
      }
      IOC.reg(FallbackService);

      @Component()
      class FallbackConsumer {
        @Autowired()
        service!: FallbackService;
      }
      IOC.reg(FallbackConsumer);

      const ins = IOC.get(FallbackConsumer);
      expect(ins.service).toBeInstanceOf(FallbackService);
      expect(ins.service.run()).toBe("fallback_ok");
    });

    test("should throw when no paramName and no design:type available", () => {
      const getMetadataSpy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);

      expect(() => {
        class NoTypeClass {
          @Autowired()
          dep: any;
        }
      }).toThrow("Autowired should refuse to inject incorrect types");

      getMetadataSpy.mockRestore();
    });

    test("should throw when no paramName and design:type is Object", () => {
      const getMetadataSpy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue({ name: "Object" });

      expect(() => {
        class ObjectTypeClass {
          @Autowired()
          dep: any;
        }
      }).toThrow("Autowired should refuse to inject incorrect types");

      getMetadataSpy.mockRestore();
    });
  });

  describe("TC39 field decorator mode", () => {
    function createTC39Context(fieldName: string, initializers: Function[]) {
      return {
        kind: "field",
        name: fieldName,
        metadata: {},
        addInitializer(fn: Function) {
          initializers.push(fn);
        },
      };
    }

    test("should route to TC39 handler when TC39 context is passed", () => {
      const savePropertyDataSpy = jest.spyOn(IOC, 'savePropertyData').mockClear();
      const initializers: Function[] = [];

      @Component()
      class TC39Service {
        run() { return "tc39_ok"; }
      }
      IOC.reg(TC39Service);

      const decorator = Autowired(TC39Service);
      const ctx = createTC39Context("service", initializers);
      decorator(undefined, ctx);

      expect(initializers).toHaveLength(1);

      class TC39Consumer {}
      initializers[0].call(new TC39Consumer());

      expect(savePropertyDataSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          identifier: "TC39Service",
          delay: false,
        }),
        TC39Consumer.prototype,
        "service"
      );

      savePropertyDataSpy.mockRestore();
    });

    test("should use field name as identifier when no paramName in TC39 mode", () => {
      const savePropertyDataSpy = jest.spyOn(IOC, 'savePropertyData').mockClear();
      const initializers: Function[] = [];

      const decorator = Autowired();
      const ctx = createTC39Context("myService", initializers);
      decorator(undefined, ctx);

      expect(initializers).toHaveLength(1);

      class Dummy {}
      initializers[0].call(new Dummy());

      expect(savePropertyDataSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          identifier: "MyService",
        }),
        Dummy.prototype,
        "myService"
      );

      savePropertyDataSpy.mockRestore();
    });

    test("should use string paramName as identifier in TC39 mode", () => {
      const savePropertyDataSpy = jest.spyOn(IOC, 'savePropertyData').mockClear();
      const initializers: Function[] = [];

      const decorator = Autowired("customDep");
      const ctx = createTC39Context("dep", initializers);
      decorator(undefined, ctx);

      expect(initializers).toHaveLength(1);

      class Dummy {}
      initializers[0].call(new Dummy());

      expect(savePropertyDataSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          identifier: "CustomDep",
        }),
        Dummy.prototype,
        "dep"
      );

      savePropertyDataSpy.mockRestore();
    });

    test("should throw for Controller cType in TC39 mode", () => {
      const initializers: Function[] = [];

      const decorator = Autowired("SomeController", "CONTROLLER");
      const ctx = createTC39Context("ctrl", initializers);

      expect(() => decorator(undefined, ctx)).toThrow("Controller bean cannot be injection!");
    });

    test("should set delay=true when no paramName in TC39 mode", () => {
      const savePropertyDataSpy = jest.spyOn(IOC, 'savePropertyData').mockClear();
      const initializers: Function[] = [];

      const decorator = Autowired();
      const ctx = createTC39Context("someField", initializers);
      decorator(undefined, ctx);

      expect(initializers).toHaveLength(1);

      class Dummy {}
      initializers[0].call(new Dummy());

      expect(savePropertyDataSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ delay: true }),
        Dummy.prototype,
        "someField"
      );

      savePropertyDataSpy.mockRestore();
    });

    test("should set delay=false when explicit class paramName in TC39 mode", () => {
      const savePropertyDataSpy = jest.spyOn(IOC, 'savePropertyData').mockClear();
      const initializers: Function[] = [];

      @Component()
      class ExplicitTC39Svc {}

      const decorator = Autowired(ExplicitTC39Svc);
      const ctx = createTC39Context("svc", initializers);
      decorator(undefined, ctx);

      expect(initializers).toHaveLength(1);

      class Dummy {}
      initializers[0].call(new Dummy());

      expect(savePropertyDataSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ delay: false }),
        Dummy.prototype,
        "svc"
      );

      savePropertyDataSpy.mockRestore();
    });

    test("should support constructArgs in TC39 mode", () => {
      const savePropertyDataSpy = jest.spyOn(IOC, 'savePropertyData').mockClear();
      const initializers: Function[] = [];
      const args = [{ arg1: "val" }];

      @Component()
      class TC39ArgSvc {}

      const decorator = Autowired(TC39ArgSvc, "COMPONENT", args);
      const ctx = createTC39Context("svc", initializers);
      decorator(undefined, ctx);

      expect(initializers).toHaveLength(1);

      class Dummy {}
      initializers[0].call(new Dummy());

      expect(savePropertyDataSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ args }),
        Dummy.prototype,
        "svc"
      );

      savePropertyDataSpy.mockRestore();
    });
  });
});
