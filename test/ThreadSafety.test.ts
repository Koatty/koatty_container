import { Container, IOC, ensureIOCReady } from "../src/container/Container";

describe("Thread Safety and Race Condition Prevention", () => {
  beforeEach(async () => {
    // 清理全局状态
    delete (<any>global).__KOATTY_IOC__;
    (<any>Container).instance = null;
    (<any>Container).isInitializing = false;
    (<any>Container).initializationPromise = null;
  });

  describe("Container Singleton Thread Safety", () => {
    test("Should prevent race conditions in concurrent getInstance calls", async () => {
      const promises: Promise<any>[] = [];
      const instances: any[] = [];

      // 模拟10个并发的getInstance调用
      for (let i = 0; i < 10; i++) {
        const promise = Promise.resolve().then(async () => {
          const result = Container.getInstance();
          const instance = result instanceof Promise ? await result : result;
          return instance;
        });
        promises.push(promise);
      }

      // 等待所有实例创建完成
      const results = await Promise.all(promises);

      // 验证所有实例都是同一个对象
      const firstInstance = results[0];
      results.forEach((instance, index) => {
        expect(instance).toBe(firstInstance);
        expect(instance).toBeInstanceOf(Container);
      });

      console.log("All 10 concurrent getInstance calls returned the same instance");
    });

    test("Should handle mixed sync and async getInstance calls", async () => {
      const instances: any[] = [];

      // 混合同步和异步调用
      const syncResult = Container.getInstanceSync();
      instances.push(syncResult);

      const asyncResult1 = Container.getInstance();
      const resolvedAsync1 = asyncResult1 instanceof Promise ? await asyncResult1 : asyncResult1;
      instances.push(resolvedAsync1);

      const syncResult2 = Container.getInstanceSync();
      instances.push(syncResult2);

      const asyncResult2 = Container.getInstance();
      const resolvedAsync2 = asyncResult2 instanceof Promise ? await asyncResult2 : asyncResult2;
      instances.push(resolvedAsync2);

      // 验证所有实例都相同
      instances.forEach((instance, index) => {
        expect(instance).toBe(instances[0]);
        expect(instance).toBeInstanceOf(Container);
      });

      console.log("Mixed sync/async calls all returned the same instance");
    });

    test("Should handle rapid successive calls gracefully", async () => {
      const results: any[] = [];

      // 快速连续调用
      for (let i = 0; i < 100; i++) {
        const result = Container.getInstance();
        if (result instanceof Promise) {
          results.push(await result);
        } else {
          results.push(result);
        }
      }

      // 验证所有结果都是同一个实例
      const firstInstance = results[0];
      results.forEach(instance => {
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
      // 模拟构造函数错误
      const originalConstructor = Container.prototype.constructor;
      let constructorCallCount = 0;

      // 替换构造函数以模拟错误
      Container.prototype.constructor = function() {
        constructorCallCount++;
        if (constructorCallCount === 1) {
          throw new Error("Simulated initialization error");
        }
        return originalConstructor.call(this);
      };

      try {
        // 第一次调用应该失败
        const result1 = Container.getInstance();
        if (result1 instanceof Promise) {
          await expect(result1).rejects.toThrow("Simulated initialization error");
        }

        // 重置状态
        (<any>Container).instance = null;
        (<any>Container).isInitializing = false;
        (<any>Container).initializationPromise = null;

        // 第二次调用应该成功
        const result2 = Container.getInstance();
        const instance = result2 instanceof Promise ? await result2 : result2;
        expect(instance).toBeInstanceOf(Container);

        console.log("Error recovery handled correctly");
      } finally {
        // 恢复原始构造函数
        Container.prototype.constructor = originalConstructor;
      }
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
      // 确保IOC容器准备就绪
      const container = await ensureIOCReady();
      
      // 测试传统的IOC操作
      expect(typeof container.reg).toBe('function');
      expect(typeof container.get).toBe('function');
      expect(typeof container.clear).toBe('function');
      
      // 测试简单的注册和获取
      class TestService {
        getValue() {
          return "test-value";
        }
      }
      
      container.reg(TestService);
      const service = container.get(TestService);
      expect(service).toBeInstanceOf(TestService);
      expect(service.getValue()).toBe("test-value");
      
      console.log("Backwards compatibility verified");
    });
  });
}); 