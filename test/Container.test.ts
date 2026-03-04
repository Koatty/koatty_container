import assert from "assert";
import { IOC, Container } from "../src/container/container";
import { ClassA } from "./ClassA";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { TAGGED_PROP } from "../src/container/icontainer";


describe("Container", () => {
  beforeAll(() => {
    IOC.reg(MyDependency);
    IOC.reg(MyDependency2);
    IOC.reg("ClassA", ClassA);
  })

  test("SetOrGetApp", () => {
    const app = Object.create(null);
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

})

describe("Strict Lifetime Mode", () => {
  let testContainer: Container;

  beforeEach(() => {
    // Create a fresh container for each test
    testContainer = new (Container as any)();
  });

  test("should throw error when Singleton depends on Prototype with strictLifetime=true", () => {
    // Define a Prototype dependency
    class PrototypeDep1 {
      name = "prototype1";
    }

    // Define a Singleton that depends on Prototype
    class SingletonWithPrototypeDep1 {
      dep!: PrototypeDep1;
    }

    // Manually set up dependency metadata (simulating @Autowired)
    testContainer.savePropertyData(TAGGED_PROP, {
      type: 'COMPONENT',
      identifier: 'PrototypeDep1',
      delay: false,
      args: []
    }, SingletonWithPrototypeDep1, 'dep');

    // Register Prototype first
    testContainer.reg(PrototypeDep1, { scope: 'Prototype' });

    // Should throw when registering Singleton with strictLifetime=true
    expect(() => {
      testContainer.reg(SingletonWithPrototypeDep1, { scope: 'Singleton', strictLifetime: true });
    }).toThrow(/Strict Mode: Singleton 'SingletonWithPrototypeDep1' cannot depend on Prototype/);
  });

  test("should not throw when Singleton depends on Singleton with strictLifetime=true", () => {
    class SingletonDep1 {
      name = "singleton1";
    }

    class SingletonWithSingletonDep1 {
      dep!: SingletonDep1;
    }

    // Manually set up dependency metadata
    testContainer.savePropertyData(TAGGED_PROP, {
      type: 'COMPONENT',
      identifier: 'SingletonDep1',
      delay: false,
      args: []
    }, SingletonWithSingletonDep1, 'dep');

    // Register both as Singleton
    testContainer.reg(SingletonDep1, { scope: 'Singleton' });

    // Should not throw
    expect(() => {
      testContainer.reg(SingletonWithSingletonDep1, { scope: 'Singleton', strictLifetime: true });
    }).not.toThrow();
  });

  test("should not throw when strictLifetime is false (default)", () => {
    class PrototypeDepDefault {
      name = "prototype-default";
    }

    class SingletonWithPrototypeDepDefault {
      dep!: PrototypeDepDefault;
    }

    // Manually set up dependency metadata
    testContainer.savePropertyData(TAGGED_PROP, {
      type: 'COMPONENT',
      identifier: 'PrototypeDepDefault',
      delay: false,
      args: []
    }, SingletonWithPrototypeDepDefault, 'dep');

    // Register Prototype
    testContainer.reg(PrototypeDepDefault, { scope: 'Prototype' });

    // Should NOT throw when strictLifetime is not set (default behavior)
    expect(() => {
      testContainer.reg(SingletonWithPrototypeDepDefault, { scope: 'Singleton' });
    }).not.toThrow();
  });
})

describe("Symbol.dispose", () => {
  let disposeContainer: Container;

  beforeEach(() => {
    disposeContainer = new (Container as any)();
  });

  test("should have Symbol.dispose method", () => {
    expect(typeof disposeContainer[Symbol.dispose]).toBe('function');
  });

  test("should clear container state when Symbol.dispose is called", () => {
    class TestService {
      name = "test";
    }

    disposeContainer.reg(TestService);
    
    const instance = disposeContainer.getInsByClass(TestService);
    expect(instance).toBeInstanceOf(TestService);

    disposeContainer[Symbol.dispose]!();

    const classList = disposeContainer.listClass('COMPONENT');
    expect(classList.length).toBe(0);
  });

  test("should work with using declaration pattern", () => {
    if (typeof Symbol.dispose === 'symbol') {
      class DisposableTestService {
        value = 42;
      }

      {
        using localContainer = new (Container as any)();
        localContainer.reg(DisposableTestService);
        const instance = localContainer.get(DisposableTestService);
        expect(instance.value).toBe(42);
      }

    }
  });
});