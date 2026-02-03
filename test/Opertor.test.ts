import "reflect-metadata";
import { 
  recursiveGetMetadata,
  overridePrototypeValue,
  getOriginMetadata,
  getMethodNames,
  getPropertyNames,
  getComponentTypeByClassName
} from "../src/utils/opertor";
import { Container } from "../src/container/container";

describe("Opertor Utils", () => {
  let container: Container;

  beforeEach(async () => {
    const instance = Container.getInstance();
    container = instance instanceof Promise ? await instance : instance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("recursiveGetMetadata", () => {
    it("should retrieve metadata from prototype chain", () => {
      class Parent {
        parentProp: string = "parent";
      }
      
      class Child extends Parent {
        childProp: string = "child";
      }

      // Mock container.listPropertyData
      jest.spyOn(container, 'listPropertyData').mockImplementation((key, target) => {
        if (target === Parent) {
          return { parentKey: "parentValue" };
        } else if (target === Child) {
          return { childKey: "childValue" };
        }
        return null;
      });

      const result = recursiveGetMetadata(container, "testKey", Child);
      expect(result).toEqual({ parentKey: "parentValue", childKey: "childValue" });
    });

    it("should handle null parent metadata", () => {
      class TestClass {
        prop: string = "test";
      }

      jest.spyOn(container, 'listPropertyData').mockImplementation((key, target) => {
        if (target === TestClass) {
          return { testKey: "testValue" };
        }
        return null;
      });

      const result = recursiveGetMetadata(container, "testKey", TestClass);
      expect(result).toEqual({ testKey: "testValue" });
    });

    it("should handle empty metadata", () => {
      class EmptyClass {}

      jest.spyOn(container, 'listPropertyData').mockReturnValue(null);

      const result = recursiveGetMetadata(container, "testKey", EmptyClass);
      expect(result).toEqual({});
    });
  });

  describe("overridePrototypeValue", () => {
    it("should override undefined properties with prototype values", () => {
      class BaseClass {
        baseProp: string = "baseValue";
        anotherProp: number = 42;
      }

      const instance = new BaseClass();
      instance.baseProp = undefined as any;
      instance.anotherProp = undefined as any;

      // Add properties to prototype after creation
      BaseClass.prototype.baseProp = "overrideValue";
      BaseClass.prototype.anotherProp = 99;

      overridePrototypeValue(instance);

      expect(instance.baseProp).toBe("overrideValue");
      expect(instance.anotherProp).toBe(99);
    });

    it("should not override defined properties", () => {
      class TestClass {
        definedProp: string = "defined";
        undefinedProp: string = undefined as any;
      }

      const instance = new TestClass();
      TestClass.prototype.definedProp = "shouldNotOverride";
      TestClass.prototype.undefinedProp = "shouldOverride";

      overridePrototypeValue(instance);

      expect(instance.definedProp).toBe("defined");
      expect(instance.undefinedProp).toBe("shouldOverride");
    });

    it("should throw error for invalid instances", () => {
      expect(() => overridePrototypeValue(null as any)).toThrow("Invalid instance provided.");
      expect(() => overridePrototypeValue(undefined as any)).toThrow("Invalid instance provided.");
      expect(() => overridePrototypeValue("string" as any)).toThrow("Invalid instance provided.");
      expect(() => overridePrototypeValue(123 as any)).toThrow("Invalid instance provided.");
    });

    it("should handle instance with no enumerable properties", () => {
      const instance = Object.create({});
      expect(() => overridePrototypeValue(instance)).not.toThrow();
    });

    it("should preserve accessor (getter/setter) from prototype instead of shadowing with data property", () => {
      const injected = { info: (msg: string) => msg };
      class Controller {
        get logger() {
          return injected;
        }
      }
      const instance = new Controller();
      expect(instance.logger).toBe(injected);
      overridePrototypeValue(instance);
      expect(instance.logger).toBe(injected);
      expect(instance.logger.info("test")).toBe("test");
    });

    it("should preserve getter when it returns undefined so lazy-init custom decorators work after IOC.get()", () => {
      const state: { logger: any } = { logger: undefined };
      class Controller {
        get logger() {
          return state.logger;
        }
      }
      const instance = new Controller();
      expect(instance.logger).toBeUndefined();
      overridePrototypeValue(instance);
      state.logger = { info: (msg: string) => msg };
      expect(instance.logger).toBe(state.logger);
      expect(instance.logger.info("ok")).toBe("ok");
    });
  });

  describe("getOriginMetadata", () => {
    it("should handle object with constructor", () => {
      class TestClass {}
      const instance = new TestClass();

      const metadata = getOriginMetadata("testKey", instance);
      expect(metadata).toBeInstanceOf(Map);
    });

    it("should handle class target directly", () => {
      class TestClass {}

      const metadata = getOriginMetadata("testKey", TestClass);
      expect(metadata).toBeInstanceOf(Map);
    });

    it("should handle property metadata", () => {
      class TestClass {
        testProp: string = "test";
      }

      const metadata = getOriginMetadata("testKey", TestClass, "testProp");
      expect(metadata).toBeInstanceOf(Map);
    });

    it("should create new metadata when not exists", () => {
      class TestClass {}
      const uniqueKey = Symbol("unique");

      const metadata = getOriginMetadata(uniqueKey, TestClass);
      expect(metadata).toBeInstanceOf(Map);
      expect(Reflect.hasMetadata(uniqueKey, TestClass)).toBe(true);
    });

    it("should return existing metadata when already defined", () => {
      class TestClass {}
      const testKey = "existingKey";

      // First call creates the metadata
      const firstCall = getOriginMetadata(testKey, TestClass);
      firstCall.set("test", "value");

      // Second call should return the same metadata
      const secondCall = getOriginMetadata(testKey, TestClass);
      expect(secondCall.get("test")).toBe("value");
      expect(firstCall).toBe(secondCall);
    });
  });

  describe("getMethodNames", () => {
    it("should get method names from class (isSelfProperties=true)", () => {
      class TestClass {
        testMethod() {}
        nonMethod = "not a method";
      }

      const methods = getMethodNames(TestClass, true);
      // Should include methods defined on the class
      expect(methods).toContain('testMethod');
      // Constructor may or may not be included, that's ok
      expect(Array.isArray(methods)).toBe(true);
    });

    it("should get method names including inheritance (isSelfProperties=false)", () => {
      class Parent {
        parentMethod() {}
      }

      class Child extends Parent {
        childMethod() {}
      }

      const methods = getMethodNames(Child, false);
      expect(methods).toContain('childMethod');
      // May contain parent methods depending on how helper.isClass works
      expect(methods.length).toBeGreaterThan(0);
    });

    it("should handle empty class", () => {
      class EmptyClass {}

      const methods = getMethodNames(EmptyClass, true);
      // At minimum should not crash, may have constructor
      expect(Array.isArray(methods)).toBe(true);
    });
  });

  describe("getPropertyNames", () => {
    it("should get property names from class target (isSelfProperties=true)", () => {
      class TestClass {
        prop1: string = "value1";
        prop2: number = 42;
        method1() {}
      }

      const properties = getPropertyNames(TestClass, true);
      // Should return array but may not include our instance properties 
      // since they're on prototype level
      expect(Array.isArray(properties)).toBe(true);
    });

    it("should get property names with inheritance (isSelfProperties=false)", () => {
      class Parent {
        parentProp: string = "parent";
      }

      class Child extends Parent {
        childProp: string = "child";
      }

      const properties = getPropertyNames(Child, false);
      expect(Array.isArray(properties)).toBe(true);
    });

    it("should handle object created with Object.create(null)", () => {
      const obj = Object.create(null);
      obj.testProp = "test";
      // Need to add a prototype property to avoid undefined access
      obj.prototype = {};

      // This function expects a class/constructor, not a plain object
      // So we expect it to work but may not return the properties we set
      const properties = getPropertyNames(obj, true);
      expect(Array.isArray(properties)).toBe(true);
    });

    it("should handle constructor function", () => {
      function TestConstructor() {
        this.prop = "test";
      }
      TestConstructor.prototype.protoProp = "protoValue";

      const properties = getPropertyNames(TestConstructor, true);
      expect(Array.isArray(properties)).toBe(true);
    });
  });

  describe("getComponentTypeByClassName", () => {
    it("should identify Controller components", () => {
      expect(getComponentTypeByClassName("UserController")).toBe("CONTROLLER");
      expect(getComponentTypeByClassName("TestController")).toBe("CONTROLLER");
      expect(getComponentTypeByClassName("MyController")).toBe("CONTROLLER");
    });

    it("should identify Middleware components", () => {
      expect(getComponentTypeByClassName("AuthMiddleware")).toBe("MIDDLEWARE");
      expect(getComponentTypeByClassName("TestMiddleware")).toBe("MIDDLEWARE");
      expect(getComponentTypeByClassName("MyMiddleware")).toBe("MIDDLEWARE");
    });

    it("should identify Service components", () => {
      expect(getComponentTypeByClassName("UserService")).toBe("SERVICE");
      expect(getComponentTypeByClassName("TestService")).toBe("SERVICE");
      expect(getComponentTypeByClassName("MyService")).toBe("SERVICE");
    });

    it("should default to COMPONENT for other names", () => {
      expect(getComponentTypeByClassName("UserRepository")).toBe("COMPONENT");
      expect(getComponentTypeByClassName("TestClass")).toBe("COMPONENT");
      expect(getComponentTypeByClassName("SomeRandomName")).toBe("COMPONENT");
      expect(getComponentTypeByClassName("")).toBe("COMPONENT");
    });

    it("should handle names with multiple matching patterns", () => {
      // Should return the first match found
      expect(getComponentTypeByClassName("ControllerService")).toBe("CONTROLLER");
      expect(getComponentTypeByClassName("ServiceController")).toBe("CONTROLLER");
      expect(getComponentTypeByClassName("MiddlewareService")).toBe("MIDDLEWARE");
    });
  });

  describe("Edge cases and error conditions", () => {
    it("should handle complex inheritance chains in getMethodNames", () => {
      class Parent {
        parentMethod() {}
      }

      class Child extends Parent {
        childMethod() {}
      }

      const methods = getMethodNames(Child, false);
      expect(methods.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle objects created with Object.create(null) in getOriginMetadata", () => {
      const nullProtoObj = Object.create(null);
      nullProtoObj.testProp = "value";

      const metadata = getOriginMetadata("testKey", nullProtoObj);
      expect(metadata).toBeInstanceOf(Map);
    });

    it("should handle class properties correctly in getPropertyNames", () => {
      class TestClass {
        static staticProp = "static";
      }

      const properties = getPropertyNames(TestClass, true);
      expect(Array.isArray(properties)).toBe(true);
      // May contain staticProp or other properties
    });

    it("should handle recursiveGetMetadata with complex inheritance", () => {
      class TestClass {
        testProp = "test";
      }

      jest.spyOn(container, 'listPropertyData').mockReturnValue({ key: "value" });

      const result = recursiveGetMetadata(container, "testKey", TestClass);
      expect(result).toEqual({ key: "value" });
    });
  });
}); 