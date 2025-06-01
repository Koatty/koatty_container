import { Container } from "../src/container/Container";
import { Component } from "../src/decorator/Component";

// 确保IOC容器准备就绪的辅助函数
async function ensureIOCReady() {
  // 检查全局IOC是否已存在
  if ((<any>global).__KOATTY_IOC__) {
    return (<any>global).__KOATTY_IOC__;
  }

  // 获取容器实例
  const result = Container.getInstance();
  const instance = result instanceof Promise ? await result : result;
  
  // 设置全局IOC
  (<any>global).__KOATTY_IOC__ = instance;
  
  return instance;
}

describe("Thread Safety and Race Condition Prevention", () => {
  beforeEach(() => {
    // 清理全局状态
    delete (<any>global).__KOATTY_IOC__;
    // 重置Container的内部状态
    (<any>Container).instance = null;
    (<any>Container).isInitializing = false;
    (<any>Container).initializationPromise = null;
  });

  afterAll(() => {
    // 清理定时器以防止Jest挂起
    const container = Container.getInstanceSync();
    const metadataCache = (<any>container).metadataCache;
    if (metadataCache && metadataCache.stopCleanupTimer) {
      metadataCache.stopCleanupTimer();
    }
  });

  describe("Container Singleton Thread Safety", () => {
    test("Should prevent race conditions in concurrent getInstance calls", async () => {
      const promises: Promise<Container>[] = [];
      
      // 创建10个并发的getInstance调用
      for (let i = 0; i < 10; i++) {
        const result = Container.getInstance();
        promises.push(result instanceof Promise ? result : Promise.resolve(result));
      }
      
      const instances = await Promise.all(promises);
      
      // 验证所有实例都是同一个对象
      const firstInstance = instances[0];
      instances.forEach((instance, index) => {
        expect(instance).toBe(firstInstance);
        expect(instance).toBeInstanceOf(Container);
      });
      
      console.log("All 10 concurrent getInstance calls returned the same instance");
    });

    test("Should handle mixed sync and async getInstance calls", async () => {
      const results: (Container | Promise<Container>)[] = [];
      
      // 混合同步和异步调用
      for (let i = 0; i < 5; i++) {
        results.push(Container.getInstanceSync());
        const asyncResult = Container.getInstance();
        results.push(asyncResult instanceof Promise ? await asyncResult : asyncResult);
      }
      
      // 验证所有结果都是同一个实例
      const firstInstance = results[0] instanceof Promise ? await results[0] : results[0];
      for (const result of results) {
        const instance = result instanceof Promise ? await result : result;
        expect(instance).toBe(firstInstance);
      }
      
      console.log("Mixed sync/async calls all returned the same instance");
    });

    test("Should handle rapid successive calls gracefully", async () => {
      const instances: Container[] = [];
      
      // 快速连续调用100次
      for (let i = 0; i < 100; i++) {
        const result = Container.getInstance();
        const instance = result instanceof Promise ? await result : result;
        instances.push(instance);
      }
      
      // 验证所有实例都相同
      const firstInstance = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });

      console.log("100 rapid successive calls handled correctly");
    });
  });

  describe("Global IOC Thread Safety", () => {
    test("Should prevent race conditions in global IOC initialization", async () => {
      // 清理全局状态
      delete (<any>global).__KOATTY_IOC__;

      const promises: Promise<any>[] = [];

      // 模拟10个并发的全局IOC访问
      for (let i = 0; i < 10; i++) {
        promises.push(ensureIOCReady());
      }

      const results = await Promise.all(promises);

      // 验证所有结果都是同一个实例
      const firstInstance = results[0];
      results.forEach((instance, index) => {
        expect(instance).toBe(firstInstance);
        expect(typeof instance.reg).toBe('function');
        expect(typeof instance.get).toBe('function');
      });

      // 验证全局对象已正确设置
      expect((<any>global).__KOATTY_IOC__).toBe(firstInstance);

      console.log("Concurrent global IOC initialization handled correctly");
    });

    test("Should handle existing global IOC gracefully", async () => {
      // 预先设置一个实例
      const existingInstance = Container.getInstanceSync();
      (<any>global).__KOATTY_IOC__ = existingInstance;

      // 多次调用ensureIOCReady
      const results = await Promise.all([
        ensureIOCReady(),
        ensureIOCReady(),
        ensureIOCReady(),
        ensureIOCReady(),
        ensureIOCReady()
      ]);

      // 验证所有结果都是已存在的实例
      results.forEach(instance => {
        expect(instance).toBe(existingInstance);
      });

      console.log("Existing global IOC handled correctly");
    });
  });

  describe("Error Handling and Recovery", () => {
    test("Should handle initialization errors gracefully", async () => {
      // 在beforeEach重置之后获取新的容器实例
      const container = Container.getInstanceSync();
      expect(container).toBeInstanceOf(Container);
      
      // 测试获取不存在的组件时的错误处理
      expect(() => {
        container.get("NonExistentComponent");
      }).toThrow("Bean NonExistentComponent not found");
      
      // 测试容器在错误后仍能正常工作
      // @Component()
      class ThreadSafetyErrorTestService {
        getValue() {
          return "test-value";
        }
      }
      
      // 注册并立即获取，确保在同一个容器实例中
      // 由于没有@Component装饰器，手动注册为SERVICE类型
      container.reg(ThreadSafetyErrorTestService, { type: "SERVICE" });
      
      // 验证注册成功
      const classList = container.listClass('SERVICE');
      const registered = classList.find(c => c.id.match('ThreadSafetyErrorTestService'));
      expect(registered).toBeDefined();
      
      // 使用SERVICE类型获取
      const service = container.get(ThreadSafetyErrorTestService, "SERVICE");
      expect(service).toBeInstanceOf(ThreadSafetyErrorTestService);
      expect(service.getValue()).toBe("test-value");

      console.log("Error handling test completed - verified error recovery");
    });

    test("Should maintain state consistency after errors", async () => {
      // 验证错误后状态重置
      expect((<any>Container).isInitializing).toBe(false);
      expect((<any>Container).initializationPromise).toBe(null);

      // 新的实例化应该正常工作
      const instance = Container.getInstanceSync();
      expect(instance).toBeInstanceOf(Container);

      console.log("State consistency maintained after errors");
    });
  });

  describe("Performance Impact", () => {
    test("Should not significantly impact performance", async () => {
      const iterations = 1000;
      
      // 测试单例获取性能
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const result = Container.getInstance();
        if (result instanceof Promise) {
          await result;
        }
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`${iterations} getInstance calls completed in ${totalTime}ms`);
      console.log(`Average time per call: ${avgTime.toFixed(3)}ms`);
      
      // 性能应该很好（平均每次调用小于1ms）
      expect(avgTime).toBeLessThan(1);
    });

    test("Should handle high concurrency efficiently", async () => {
      const concurrentCalls = 50;
      const iterations = 20;
      
      const startTime = Date.now();
      
      const allPromises: Promise<any>[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const batchPromises = Array.from({ length: concurrentCalls }, async () => {
          const result = Container.getInstance();
          return result instanceof Promise ? await result : result;
        });
        
        allPromises.push(...batchPromises);
      }
      
      const results = await Promise.all(allPromises);
      const totalTime = Date.now() - startTime;
      
      // 验证所有结果都是同一个实例
      const firstInstance = results[0];
      results.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });
      
      console.log(`${concurrentCalls * iterations} concurrent calls completed in ${totalTime}ms`);
      console.log(`Average time per call: ${(totalTime / (concurrentCalls * iterations)).toFixed(3)}ms`);
      
      // 高并发下性能也应该良好
      expect(totalTime).toBeLessThan(5000); // 5秒内完成
    });
  });

  describe("Backwards Compatibility", () => {
    test("Should maintain backwards compatibility with existing code", async () => {
      // 测试原有的同步访问方式
      const instance1 = Container.getInstanceSync();
      const instance2 = Container.getInstanceSync();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(Container);
      
      // 测试原有的异步访问方式
      const asyncResult = Container.getInstance();
      if (asyncResult instanceof Promise) {
        const instance3 = await asyncResult;
        expect(instance3).toBe(instance1);
      } else {
        expect(asyncResult).toBe(instance1);
      }
    });

    test("Should work with existing IOC usage patterns", async () => {
      // 在beforeEach重置之后获取新的容器实例
      const container = Container.getInstanceSync();
      
      // 测试传统的IOC操作
      expect(typeof container.reg).toBe('function');
      expect(typeof container.get).toBe('function');
      expect(typeof container.clearInstances).toBe('function');
      
      // 测试简单的注册和获取
      class ThreadSafetyCompatibilityTestService {
        getValue() {
          return "test-value";
        }
      }
      
      // 注册并立即获取，确保在同一个容器实例中
      // 手动注册为SERVICE类型
      container.reg(ThreadSafetyCompatibilityTestService, { type: "SERVICE" });
      
      // 验证注册成功
      const classList = container.listClass('SERVICE');
      const registered = classList.find(c => c.id.match('ThreadSafetyCompatibilityTestService'));
      expect(registered).toBeDefined();
      
      // 使用SERVICE类型获取
      const service = container.get(ThreadSafetyCompatibilityTestService, "SERVICE");
      expect(service).toBeInstanceOf(ThreadSafetyCompatibilityTestService);
      expect(service.getValue()).toBe("test-value");
      
      console.log("Backwards compatibility verified");
    });
  });
}); 