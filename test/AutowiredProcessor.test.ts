import "reflect-metadata";
import { 
  injectAutowired, 
  batchPreprocessDependencies, 
  clearDependencyCache,
  optimizeDependencyCache,
  warmupDependencyCache,
  getDependencyCacheSize,
  getAutowiredCacheStats,
  logDependencyCachePerformance
} from "../src/processor/autowired_processor";
import { Container } from "../src/container/container";
import { TAGGED_PROP } from "../src/container/icontainer";
import { Autowired } from "../src/decorator/autowired";
import { Component } from "./helpers/decorators";

// Mock the event system for delayed injection tests
class MockEventEmitter {
  private handlers: Map<string, Function[]> = new Map();
  
  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }
  
  emit(event: string, ...args: any[]) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }
}

describe("Autowired Processor Coverage Tests", () => {
  let container: Container;
  let mockApp: MockEventEmitter;

  beforeEach(async () => {
    container = Container.getInstanceSync();
    container.clear();
    
    mockApp = new MockEventEmitter();
    jest.spyOn(container, 'getApp').mockReturnValue(mockApp as any);
    
    clearDependencyCache();
  });

  afterEach(() => {
    container.clear();
    jest.restoreAllMocks();
  });

  describe("Cache Statistics and Performance", () => {
    it("should get cache stats correctly", () => {
      const stats = getAutowiredCacheStats();
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('memoryUsage');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
    });

    it("should log dependency cache performance", () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logDependencyCachePerformance();
      
      // Should not throw and function should complete
      expect(() => logDependencyCachePerformance()).not.toThrow();
      
      consoleSpy.mockRestore();
    });

    it("should get dependency cache size", () => {
      const size = getDependencyCacheSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Batch Preprocessing", () => {
    it("should batch preprocess dependencies for multiple targets", () => {
      @Component()
      class TestService1 {}

      @Component() 
      class TestService2 {}

      @Component()
      class TestService3 {}

      const targets = [TestService1, TestService2, TestService3];
      
      expect(() => {
        batchPreprocessDependencies(targets, container);
      }).not.toThrow();
    });

    it("should handle errors in batch preprocessing gracefully", () => {
      const invalidTarget = {} as any; // Use empty object instead of null
      const validTarget = class ValidService {};
      
      const targets = [invalidTarget, validTarget];
      
      expect(() => {
        batchPreprocessDependencies(targets, container);
      }).not.toThrow();
    });
  });

  describe("Cache Management", () => {
    it("should clear dependency cache", () => {
      expect(() => {
        clearDependencyCache();
      }).not.toThrow();
    });

    it("should optimize dependency cache", () => {
      // Add some data to cache first
      @Component()
      class TestService {}
      
      batchPreprocessDependencies([TestService], container);
      
      expect(() => {
        optimizeDependencyCache();
      }).not.toThrow();
    });

    it("should warm up dependency cache", () => {
      @Component()
      class Service1 {}

      @Component()
      class Service2 {}

      const targets = [Service1, Service2];
      
      expect(() => {
        warmupDependencyCache(targets, container);
      }).not.toThrow();
    });
  });

  describe("Delayed Injection Setup", () => {
    it("should handle app without event support", () => {
      // Mock app without 'on' method
      jest.spyOn(container, 'getApp').mockReturnValue({} as any);

      @Component()
      class TestService {
        @Autowired("MissingService", "COMPONENT", [], true)
        missingService: any;
      }

      expect(() => {
        injectAutowired(TestService, TestService.prototype, container);
      }).not.toThrow();
    });

    it("should handle null app", () => {
      jest.spyOn(container, 'getApp').mockReturnValue(null as any);

      @Component()
      class TestService {
        @Autowired("MissingService", "COMPONENT", [], true)
        missingService: any;
      }

      expect(() => {
        injectAutowired(TestService, TestService.prototype, container);
      }).not.toThrow();
    });

    it("should setup delayed injection for circular dependencies", () => {
      @Component()
      class ServiceA {
        @Autowired("ServiceB", "COMPONENT", [], true)
        serviceB: any;
      }

      @Component()
      class ServiceB {
        @Autowired("ServiceA", "COMPONENT", [], true)
        serviceA: any;
      }

      container.reg("ServiceA", ServiceA);
      container.reg("ServiceB", ServiceB);

      // This should setup delayed injection
      expect(() => {
        injectAutowired(ServiceA, ServiceA.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection
      mockApp.emit('appReady');
    });
  });

  describe("Error Handling in Injection", () => {
    it("should handle injection errors gracefully", () => {
      @Component()
      class TestService {
        @Autowired("NonExistentService")
        nonExistentService: any;
      }

      // This should not throw because it sets up delayed injection instead
      expect(() => {
        injectAutowired(TestService, TestService.prototype, container);
      }).not.toThrow();
    });

    it("should handle delayed injection errors gracefully", () => {
      @Component()
      class TestService {
        @Autowired("FailingService", "COMPONENT", [], true)
        failingService: any;
      }

      // Mock container.get to throw error
      const originalGet = container.get;
      jest.spyOn(container, 'get').mockImplementation(() => {
        throw new Error("Service not found");
      });

      expect(() => {
        injectAutowired(TestService, TestService.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection - should handle errors gracefully
      mockApp.emit('appReady');

      container.get = originalGet;
    });
  });

  describe("Circular Dependency Handling", () => {
    it("should handle circular dependencies with delayed injection", () => {
      @Component()
      class CircularServiceA {
        @Autowired("CircularServiceB", "COMPONENT", [], true)
        serviceB: any;
      }

      @Component()
      class CircularServiceB {
        @Autowired("CircularServiceA", "COMPONENT", [], true)
        serviceA: any;
      }

      container.reg("CircularServiceA", CircularServiceA);
      container.reg("CircularServiceB", CircularServiceB);

      expect(() => {
        injectAutowired(CircularServiceA, CircularServiceA.prototype, container);
        injectAutowired(CircularServiceB, CircularServiceB.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection
      mockApp.emit('appReady');

      // Check if properties are set
      const instanceA = container.get("CircularServiceA");
      const instanceB = container.get("CircularServiceB");
      
      expect(instanceA).toBeDefined();
      expect(instanceB).toBeDefined();
    });

    it("should fallback to propertyKey for circular dependencies", () => {
      @Component()
      class FallbackService {
        @Autowired("UnknownService", "COMPONENT", [], true)
        unknownService: any;
      }

      // Mock getClass to fail for name but succeed for propertyKey
      const originalGetClass = container.getClass;
      jest.spyOn(container, 'getClass').mockImplementation((name: string) => {
        if (name === "UnknownService") {
          throw new Error("Not found");
        }
        if (name === "unknownService") {
          return FallbackService;
        }
        return originalGetClass.call(container, name);
      });

      expect(() => {
        injectAutowired(FallbackService, FallbackService.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection
      mockApp.emit('appReady');

      container.getClass = originalGetClass;
    });
  });

  describe("Property Definition Edge Cases", () => {
    it("should handle defineProperty errors gracefully", () => {
      @Component()
      class TestService {
        @Autowired("SomeService", "COMPONENT", [], true)
        someService: any;
      }

      // Make prototype non-configurable to cause defineProperty to fail
      const originalDefineProperty = Object.defineProperty;
      jest.spyOn(Object, 'defineProperty').mockImplementation(() => {
        throw new Error("defineProperty failed");
      });

      expect(() => {
        injectAutowired(TestService, TestService.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection - should handle defineProperty errors
      mockApp.emit('appReady');

      Object.defineProperty = originalDefineProperty;
    });

    it("should handle instance property setting errors", () => {
      @Component()
      class TestService {
        @Autowired("InstanceService", "COMPONENT", [], true)
        instanceService: any;
      }

      container.reg("InstanceService", TestService);
      container.reg("TestService", TestService);

      // Mock getInsByClass to return an instance but cause errors during property setting
      const originalGetInsByClass = container.getInsByClass;
      jest.spyOn(container, 'getInsByClass').mockImplementation((target) => {
        if (target === TestService) {
          const instance = new TestService();
          // Make the instance property non-writable
          Object.defineProperty(instance, 'instanceService', {
            value: undefined,
            writable: false,
            configurable: false
          });
          return instance;
        }
        return originalGetInsByClass.call(container, target);
      });

      expect(() => {
        injectAutowired(TestService, TestService.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection
      mockApp.emit('appReady');

      container.getInsByClass = originalGetInsByClass;
    });
  });

  describe("Complex Dependency Scenarios", () => {
    it("should handle mixed delayed and immediate dependencies", () => {
      @Component()
      class ImmediateService {}

      @Component()
      class MixedService {
        @Autowired()
        immediateService: ImmediateService;

        @Autowired("DelayedService", "COMPONENT", [], true)
        delayedService: any;
      }

      container.reg("ImmediateService", ImmediateService);
      container.reg("MixedService", MixedService);

      expect(() => {
        injectAutowired(MixedService, MixedService.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection
      mockApp.emit('appReady');
    });

    it("should handle dependencies with custom arguments", () => {
      @Component()
      class ServiceWithArgs {
        constructor(public arg1?: string, public arg2?: number) {}
      }

      @Component()
      class TestService {
        @Autowired("ServiceWithArgs", "COMPONENT", ["test", 123], true)
        serviceWithArgs: ServiceWithArgs;
      }

      container.reg("ServiceWithArgs", ServiceWithArgs);

      expect(() => {
        injectAutowired(TestService, TestService.prototype, container);
      }).not.toThrow();

      // Trigger delayed injection
      mockApp.emit('appReady');
    });
  });
}); 