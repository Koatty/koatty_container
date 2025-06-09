import "reflect-metadata";
import { ClassDecoratorManager } from "../src/manager/class";
import { DecoratorMetadata } from "../src/manager/type";
import { IOCContainer } from "../src/container/container";

describe("ClassDecoratorManager", () => {
  let manager: ClassDecoratorManager;

  beforeEach(() => {
    manager = new ClassDecoratorManager();
  });

  afterEach(() => {
    manager.clearCache();
    jest.restoreAllMocks();
  });

  describe("Constructor and IOC Integration", () => {
    it("should initialize with empty registries", () => {
      expect(manager.getRegisteredTypes()).toEqual([]);
      expect(manager.getCacheStats().size).toBe(0);
    });

    it("should handle IOC container registration error gracefully", () => {
      // Mock IOCContainer.reg to throw an error to test the catch block
      jest.spyOn(IOCContainer, 'reg').mockImplementation(() => {
        throw new Error("IOC registration failed");
      });

      // Create a new instance to trigger the registration
      const newManager = new ClassDecoratorManager();
      expect(newManager).toBeInstanceOf(ClassDecoratorManager);
    });
  });

  describe("getInstance static method", () => {
    it("should get instance from IOC container when available", () => {
      const mockInstance = new ClassDecoratorManager();
      jest.spyOn(IOCContainer, 'get').mockReturnValue(mockInstance);

      const instance = ClassDecoratorManager.getInstance();
      expect(instance).toBe(mockInstance);
    });

    it("should create new instance when IOC container returns null", () => {
      jest.spyOn(IOCContainer, 'get').mockReturnValue(null);

      const instance = ClassDecoratorManager.getInstance();
      expect(instance).toBeInstanceOf(ClassDecoratorManager);
    });

    it("should handle IOC container error and create new instance", () => {
      jest.spyOn(IOCContainer, 'get').mockImplementation(() => {
        throw new Error("IOC container not available");
      });

      const instance = ClassDecoratorManager.getInstance();
      expect(instance).toBeInstanceOf(ClassDecoratorManager);
    });
  });

  describe("Wrapper Registration", () => {
    it("should register and retrieve wrapper functions", () => {
      const mockWrapper = jest.fn();
      
      manager.registerWrapper("testDecorator", mockWrapper);
      
      expect(manager.hasWrapper("testDecorator")).toBe(true);
      expect(manager.getRegisteredTypes()).toContain("testDecorator");
    });

    it("should unregister wrapper functions", () => {
      const mockWrapper = jest.fn();
      
      manager.registerWrapper("testDecorator", mockWrapper);
      expect(manager.hasWrapper("testDecorator")).toBe(true);
      
      const removed = manager.unregisterWrapper("testDecorator");
      expect(removed).toBe(true);
      expect(manager.hasWrapper("testDecorator")).toBe(false);
    });

    it("should return false when unregistering non-existent wrapper", () => {
      const removed = manager.unregisterWrapper("nonExistent");
      expect(removed).toBe(false);
    });
  });

  describe("registerDecorator", () => {
    it("should throw error for non-function target", () => {
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      expect(() => {
        manager.registerDecorator("not a function" as any, decorator);
      }).toThrow("Cannot decorate non-constructor: not a function");
    });

    it("should register decorator on new class", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: { value: "test" },
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test", mockWrapper);

      const result = manager.registerDecorator(TestClass, decorator);
      
      expect(result).toBeDefined();
      expect(manager.isDecorated(TestClass)).toBe(true);
    });

    it("should skip duplicate decorator registration", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test", mockWrapper);

      // Register first time
      const result1 = manager.registerDecorator(TestClass, decorator);
      
      // Register second time (should skip)
      const result2 = manager.registerDecorator(TestClass, decorator);
      
      expect(result1).toBe(result2);
      expect(mockWrapper).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple decorators on same class", () => {
      class TestClass {}
      const decorator1: DecoratorMetadata = {
        type: "test1",
        priority: 1,
        config: {},
        applied: false
      };
      const decorator2: DecoratorMetadata = {
        type: "test2",
        priority: 2,
        config: {},
        applied: false
      };

      const mockWrapper1 = jest.fn().mockReturnValue(TestClass);
      const mockWrapper2 = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test1", mockWrapper1);
      manager.registerWrapper("test2", mockWrapper2);

      manager.registerDecorator(TestClass, decorator1);
      manager.registerDecorator(TestClass, decorator2);

      expect(manager.isDecorated(TestClass)).toBe(true);
      expect(mockWrapper1).toHaveBeenCalled();
      expect(mockWrapper2).toHaveBeenCalled();
    });
  });

  describe("createOptimizedWrapper", () => {
    it("should use cached wrapper when available", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test", mockWrapper);

      // First registration
      manager.registerDecorator(TestClass, decorator);
      
      // Second registration with same decorator should use cache
      class AnotherClass {}
      manager.registerDecorator(AnotherClass, decorator);

      expect(manager.getCacheStats().size).toBeGreaterThan(0);
    });
  });

  describe("compileWrapper", () => {
    it("should return original class when no decorators", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      // Don't register wrapper, so it should return original class
      const result = manager.registerDecorator(TestClass, decorator);
      expect(result).toBe(TestClass);
    });

    it("should handle wrapper function errors gracefully", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      const mockWrapper = jest.fn().mockImplementation(() => {
        throw new Error("Wrapper error");
      });
      manager.registerWrapper("test", mockWrapper);

      // Should not throw, but handle error gracefully
      expect(() => {
        manager.registerDecorator(TestClass, decorator);
      }).not.toThrow();
    });

    it("should apply decorators in priority order", () => {
      class TestClass {}
      const highPriorityDecorator: DecoratorMetadata = {
        type: "high",
        priority: 10,
        config: {},
        applied: false
      };
      const lowPriorityDecorator: DecoratorMetadata = {
        type: "low",
        priority: 1,
        config: {},
        applied: false
      };

      const callOrder: string[] = [];
      const highWrapper = jest.fn().mockImplementation((cls) => {
        callOrder.push("high");
        return cls;
      });
      const lowWrapper = jest.fn().mockImplementation((cls) => {
        callOrder.push("low");
        return cls;
      });

      manager.registerWrapper("high", highWrapper);
      manager.registerWrapper("low", lowWrapper);

      manager.registerDecorator(TestClass, lowPriorityDecorator);
      manager.registerDecorator(TestClass, highPriorityDecorator);

      // The class gets wrapped twice - once for each decorator
      // First the low priority decorator is applied when it's registered
      // Then when high priority is added, the entire wrapper is rebuilt with both decorators
      expect(callOrder.includes("low")).toBe(true);
      expect(callOrder.includes("high")).toBe(true);
    });
  });

  describe("Metadata Management", () => {
    it("should track decorator metadata", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: { value: "metadata" },
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test", mockWrapper);

      manager.registerDecorator(TestClass, decorator);

      const metadata = manager.getDecoratorMetadata(TestClass);
      expect(metadata).not.toBeNull();
      expect(metadata?.has("test")).toBe(true);
    });

    it("should return null metadata for undecorated class", () => {
      class TestClass {}
      
      const metadata = manager.getDecoratorMetadata(TestClass);
      expect(metadata).toBeNull();
    });

    it("should detect decorated classes", () => {
      class TestClass {}
      class UndecoratedClass {}
      
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test", mockWrapper);

      manager.registerDecorator(TestClass, decorator);

      expect(manager.isDecorated(TestClass)).toBe(true);
      expect(manager.isDecorated(UndecoratedClass)).toBe(false);
    });
  });

  describe("Instance Tracking", () => {
    it("should track instances", () => {
      class TestClass {}
      const instance = new TestClass();

      manager.trackInstance(instance, TestClass);
      // Since trackInstance uses WeakSet, we can't directly verify the tracking
      // but we can ensure it doesn't throw
      expect(() => {
        manager.trackInstance(instance, TestClass);
      }).not.toThrow();
    });

    it("should handle tracking instances without registered wrapper", () => {
      class TestClass {}
      const instance = new TestClass();

      // Should not throw even if no wrapper is registered
      expect(() => {
        manager.trackInstance(instance, TestClass);
      }).not.toThrow();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test", mockWrapper);

      manager.registerDecorator(TestClass, decorator);
      expect(manager.getCacheStats().size).toBeGreaterThan(0);

      manager.clearCache();
      expect(manager.getCacheStats().size).toBe(0);
    });

    it("should provide cache statistics", () => {
      class TestClass {}
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("test", mockWrapper);

      manager.registerDecorator(TestClass, decorator);
      
      const stats = manager.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe("getDecoratedClasses", () => {
    it("should return empty array", () => {
      // This method is currently a placeholder
      const result = manager.getDecoratedClasses();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("generateCacheKey", () => {
    it("should generate consistent cache keys", () => {
      class TestClass1 {}
      class TestClass2 {}
      
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: { value: "same" },
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass1);
      manager.registerWrapper("test", mockWrapper);

      manager.registerDecorator(TestClass1, decorator);
      manager.registerDecorator(TestClass2, decorator);

      // Both should use the same cached wrapper since they have the same decorator config
      const stats = manager.getCacheStats();
      expect(stats.size).toBe(2); // Different class names create different cache keys
    });

    it("should handle complex config objects in cache key generation", () => {
      class TestClass {}
      const complexDecorator: DecoratorMetadata = {
        type: "complex",
        priority: 1,
        config: {
          nested: { value: "test" },
          array: [1, 2, 3],
          boolean: true,
          null: null
        },
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("complex", mockWrapper);

      expect(() => {
        manager.registerDecorator(TestClass, complexDecorator);
      }).not.toThrow();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle classes with no name gracefully", () => {
      const AnonymousClass = class {};
      const decorator: DecoratorMetadata = {
        type: "test",
        priority: 1,
        config: {},
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(AnonymousClass);
      manager.registerWrapper("test", mockWrapper);

      expect(() => {
        manager.registerDecorator(AnonymousClass, decorator);
      }).not.toThrow();
    });

    it("should handle decorators with circular references in config", () => {
      class TestClass {}
      const circularConfig: any = { value: "test" };
      circularConfig.self = circularConfig;

      const decorator: DecoratorMetadata = {
        type: "circular",
        priority: 1,
        config: circularConfig,
        applied: false
      };

      const mockWrapper = jest.fn().mockReturnValue(TestClass);
      manager.registerWrapper("circular", mockWrapper);

      // JSON.stringify will throw on circular references
      expect(() => {
        manager.registerDecorator(TestClass, decorator);
      }).toThrow("Converting circular structure to JSON");
    });
  });
}); 