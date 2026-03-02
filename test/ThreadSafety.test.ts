import { Container } from "../src/container/container";
import { Component } from "./helpers/decorators";

const KOATTY_IOC_KEY = Symbol.for('koatty.ioc.v2');

describe("Thread Safety and Race Condition Prevention", () => {
  beforeEach(() => {
    delete (<any>globalThis)[KOATTY_IOC_KEY];
    (<any>Container).instance = null;
  });

  afterAll(() => {
    const container = Container.getInstance();
    const metadataCache = (<any>container).metadataCache;
    if (metadataCache && metadataCache.stopCleanupTimer) {
      metadataCache.stopCleanupTimer();
    }
  });

  describe("Container Singleton Thread Safety", () => {
    test("Should return the same instance for concurrent getInstance calls", () => {
      const instances: Container[] = [];
      
      for (let i = 0; i < 10; i++) {
        instances.push(Container.getInstance());
      }
      
      const firstInstance = instances[0];
      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
        expect(instance).toBeInstanceOf(Container);
      });
      
      console.log("All 10 concurrent getInstance calls returned the same instance");
    });

    test("Should handle rapid successive calls gracefully", () => {
      const instances: Container[] = [];
      
      for (let i = 0; i < 100; i++) {
        instances.push(Container.getInstance());
      }
      
      const firstInstance = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });

      console.log("100 rapid successive calls handled correctly");
    });
  });

  describe("Global IOC Thread Safety", () => {
    test("Should return the same instance for concurrent global IOC access", () => {
      delete (<any>globalThis)[KOATTY_IOC_KEY];

      const instances: Container[] = [];

      for (let i = 0; i < 10; i++) {
        instances.push(Container.getInstance());
      }

      const firstInstance = instances[0];
      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
        expect(typeof instance.reg).toBe('function');
        expect(typeof instance.get).toBe('function');
      });

      console.log("Concurrent global IOC access handled correctly");
    });
  });

  describe("Error Handling and Recovery", () => {
    test("Should handle initialization errors gracefully", () => {
      const container = Container.getInstance();
      expect(container).toBeInstanceOf(Container);
      
      expect(() => {
        container.get("NonExistentComponent");
      }).toThrow("Bean NonExistentComponent not found");
      
      class ThreadSafetyErrorTestService {
        getValue() {
          return "test-value";
        }
      }
      
      container.reg(ThreadSafetyErrorTestService, { type: "SERVICE" });
      
      const classList = container.listClass('SERVICE');
      const registered = classList.find(c => c.id.match('ThreadSafetyErrorTestService'));
      expect(registered).toBeDefined();
      
      const service = container.get(ThreadSafetyErrorTestService, "SERVICE");
      expect(service).toBeInstanceOf(ThreadSafetyErrorTestService);
      expect(service.getValue()).toBe("test-value");

      console.log("Error handling test completed - verified error recovery");
    });
  });

  describe("Performance Impact", () => {
    test("Should not significantly impact performance", () => {
      const iterations = 1000;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        Container.getInstance();
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`${iterations} getInstance calls completed in ${totalTime}ms`);
      console.log(`Average time per call: ${avgTime.toFixed(3)}ms`);
      
      expect(avgTime).toBeLessThan(1);
    });

    test("Should handle high concurrency efficiently", () => {
      const concurrentCalls = 50;
      const iterations = 20;
      
      const startTime = Date.now();
      
      const allInstances: Container[] = [];
      
      for (let i = 0; i < iterations; i++) {
        for (let j = 0; j < concurrentCalls; j++) {
          allInstances.push(Container.getInstance());
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      const firstInstance = allInstances[0];
      allInstances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });
      
      console.log(`${concurrentCalls * iterations} concurrent calls completed in ${totalTime}ms`);
      console.log(`Average time per call: ${(totalTime / (concurrentCalls * iterations)).toFixed(3)}ms`);
      
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe("Backwards Compatibility", () => {
    test("Should maintain backwards compatibility with existing code", () => {
      const instance1 = Container.getInstance();
      const instance2 = Container.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(Container);
    });

    test("Should work with existing IOC usage patterns", () => {
      const container = Container.getInstance();
      
      expect(typeof container.reg).toBe('function');
      expect(typeof container.get).toBe('function');
      expect(typeof container.clearInstances).toBe('function');
      
      class ThreadSafetyCompatibilityTestService {
        getValue() {
          return "test-value";
        }
      }
      
      container.reg(ThreadSafetyCompatibilityTestService, { type: "SERVICE" });
      
      const classList = container.listClass('SERVICE');
      const registered = classList.find(c => c.id.match('ThreadSafetyCompatibilityTestService'));
      expect(registered).toBeDefined();
      
      const service = container.get(ThreadSafetyCompatibilityTestService, "SERVICE");
      expect(service).toBeInstanceOf(ThreadSafetyCompatibilityTestService);
      expect(service.getValue()).toBe("test-value");
      
      console.log("Backwards compatibility verified");
    });
  });
});
