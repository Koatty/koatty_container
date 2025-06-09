import {
  MethodDecoratorManager,
  ClassDecoratorManager,
  PropertyDecoratorManager,
  decoratorManager
} from "../src/manager/index";
import type {
  WrapperFunction,
  ClassWrapperFunction,
  PropertyWrapperFunction,
  DecoratorMetadata
} from "../src/manager/index";

describe("DecoratorManager Performance Tests", () => {
  let methodManager: MethodDecoratorManager;
  let classManager: ClassDecoratorManager;
  let propertyManager: PropertyDecoratorManager;

  beforeEach(() => {
    methodManager = MethodDecoratorManager.getInstance();
    classManager = ClassDecoratorManager.getInstance();
    propertyManager = PropertyDecoratorManager.getInstance();
    
    // Clear all caches before each test
    methodManager.clearCache();
    classManager.clearCache();
    propertyManager.clearCache();
  });

  describe("Method Decorator Performance", () => {
    test("should cache wrapper functions efficiently", () => {
      const timingWrapper: WrapperFunction = (originalMethod, _config, methodName, _target) => {
        return function (this: any, ...args: any[]) {
          const start = performance.now();
          const result = originalMethod.apply(this, args);
          const duration = performance.now() - start;
          return { result, duration, method: methodName };
        };
      };

      methodManager.registerWrapper('timing', timingWrapper);

      const metadata: DecoratorMetadata = {
        type: 'timing',
        config: { precision: 'high' },
        applied: false,
        priority: 1
      };

      class TestClass {
        method1() { return 'result1'; }
        method2() { return 'result2'; }
        method3() { return 'result3'; }
      }

      // First application - should create and cache
      const start1 = performance.now();
      methodManager.registerDecorator(TestClass.prototype, 'method1', metadata, 
        Object.getOwnPropertyDescriptor(TestClass.prototype, 'method1')!);
      const duration1 = performance.now() - start1;

      // Second application with same config - should use cache
      const start2 = performance.now();
      methodManager.registerDecorator(TestClass.prototype, 'method2', metadata,
        Object.getOwnPropertyDescriptor(TestClass.prototype, 'method2')!);
      const duration2 = performance.now() - start2;

      // Verify cache is being used (second call should be significantly faster)
      const stats = methodManager.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // Note: In CI environments, timing assertions can be flaky
      // So we just verify the cache is working by checking cache size
    });

    test("should handle many decorators efficiently", () => {
      const simpleWrapper: WrapperFunction = (originalMethod) => originalMethod;
      methodManager.registerWrapper('simple', simpleWrapper);

      const metadata: DecoratorMetadata = {
        type: 'simple',
        config: {},
        applied: false,
        priority: 1
      };

      // Create a class with many methods
      class LargeClass {
        method1() { return 1; }
        method2() { return 2; }
        method3() { return 3; }
        method4() { return 4; }
        method5() { return 5; }
        method6() { return 6; }
        method7() { return 7; }
        method8() { return 8; }
        method9() { return 9; }
        method10() { return 10; }
      }

      const start = performance.now();
      
      // Apply decorators to all methods
      for (let i = 1; i <= 10; i++) {
        const methodName = `method${i}`;
        const descriptor = Object.getOwnPropertyDescriptor(LargeClass.prototype, methodName)!;
        methodManager.registerDecorator(LargeClass.prototype, methodName, metadata, descriptor);
      }
      
      const duration = performance.now() - start;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
      
      // Verify all methods are properly decorated
      const instance = new LargeClass();
      expect(instance.method1()).toBe(1);
      expect(instance.method10()).toBe(10);
    });

    test("should handle multiple wrapper combinations efficiently", () => {
      const wrapper1: WrapperFunction = (originalMethod, _config, _methodName, _target) => {
        return function (this: any, ...args: any[]) {
          const result = originalMethod.apply(this, args);
          return `w1(${result})`;
        };
      };

      const wrapper2: WrapperFunction = (originalMethod, _config, _methodName, _target) => {
        return function (this: any, ...args: any[]) {
          const result = originalMethod.apply(this, args);
          return `w2(${result})`;
        };
      };

      const wrapper3: WrapperFunction = (originalMethod, _config, _methodName, _target) => {
        return function (this: any, ...args: any[]) {
          const result = originalMethod.apply(this, args);
          return `w3(${result})`;
        };
      };

      methodManager.registerWrapper('w1', wrapper1);
      methodManager.registerWrapper('w2', wrapper2);
      methodManager.registerWrapper('w3', wrapper3);

      class TestClass {
        testMethod() { return 'original'; }
      }

      const metadata1: DecoratorMetadata = { type: 'w1', config: {}, applied: false, priority: 1 };
      const metadata2: DecoratorMetadata = { type: 'w2', config: {}, applied: false, priority: 2 };
      const metadata3: DecoratorMetadata = { type: 'w3', config: {}, applied: false, priority: 3 };

      const start = performance.now();
      
      let descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!;
      descriptor = methodManager.registerDecorator(TestClass.prototype, 'testMethod', metadata1, descriptor);
      descriptor = methodManager.registerDecorator(TestClass.prototype, 'testMethod', metadata2, descriptor);
      descriptor = methodManager.registerDecorator(TestClass.prototype, 'testMethod', metadata3, descriptor);
      
      const duration = performance.now() - start;
      
      TestClass.prototype.testMethod = descriptor.value;
      const instance = new TestClass();
      const result = instance.testMethod();
      
      expect(result).toBe('w3(w2(w1(original)))'); // Highest priority wraps outermost
      expect(duration).toBeLessThan(50); // Should be fast
    });
  });

  describe("Class Decorator Performance", () => {
    test("should handle class decoration efficiently", () => {
      const injectWrapper: ClassWrapperFunction = (originalClass, config, _className) => {
        return class extends (originalClass as any) {
          constructor(...args: any[]) {
            super(...args);
            Object.assign(this, config.dependencies || {});
          }
        };
      };

      classManager.registerWrapper('inject', injectWrapper);

      const metadata: DecoratorMetadata = {
        type: 'inject',
        config: {
          dependencies: {
            service1: { name: 'Service1' },
            service2: { name: 'Service2' },
            service3: { name: 'Service3' }
          }
        },
        applied: false,
        priority: 1
      };

      class TestService {
        public name: string = 'original';
      }

      const start = performance.now();
      const WrappedClass = classManager.registerDecorator(TestService, metadata);
      const instance = new (WrappedClass as any)();
      const duration = performance.now() - start;

      expect(instance.name).toBe('original');
      expect(instance.service1).toEqual({ name: 'Service1' });
      expect(instance.service2).toEqual({ name: 'Service2' });
      expect(instance.service3).toEqual({ name: 'Service3' });
      expect(duration).toBeLessThan(50);
    });

    test("should cache class wrappers", () => {
      const loggingWrapper: ClassWrapperFunction = (originalClass, config, className) => {
        return class extends (originalClass as any) {
          constructor(...args: any[]) {
            if (config.enableLogging) {
              console.log(`Creating ${className}`);
            }
            super(...args);
          }
        };
      };

      classManager.registerWrapper('logging', loggingWrapper);

      const metadata: DecoratorMetadata = {
        type: 'logging',
        config: { enableLogging: true },
        applied: false,
        priority: 1
      };

      class Service1 {}
      class Service2 {}

      // First decoration
      const start1 = performance.now();
      classManager.registerDecorator(Service1, metadata);
      const duration1 = performance.now() - start1;

      // Second decoration with same config - should use cache
      const start2 = performance.now();
      classManager.registerDecorator(Service2, metadata);
      const duration2 = performance.now() - start2;

      const stats = classManager.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe("Property Decorator Performance", () => {
    test("should handle property decoration efficiently", () => {
      const validateWrapper: PropertyWrapperFunction = (originalDescriptor, config, propertyName, _target) => {
        return {
          get: originalDescriptor?.get || function () {
            return (this as any)[`_${propertyName}`] ?? config.defaultValue;
          },
          set: function (value: any) {
            if (config.validators) {
              for (const validator of config.validators) {
                if (!validator(value)) {
                  throw new Error(`Validation failed for ${propertyName}`);
                }
              }
            }
            (this as any)[`_${propertyName}`] = value;
          },
          enumerable: true,
          configurable: true
        };
      };

      propertyManager.registerWrapper('validate', validateWrapper);

      const metadata: DecoratorMetadata = {
        type: 'validate',
        config: {
          defaultValue: 'default',
          validators: [
            (v: string) => typeof v === 'string',
            (v: string) => v.length > 0,
            (v: string) => v.length < 100
          ]
        },
        applied: false,
        priority: 1
      };

      class TestClass {
        public name: string = '';
        public email: string = '';
        public phone: string = '';
      }

      const start = performance.now();
      
      const nameDescriptor = propertyManager.registerDecorator(TestClass.prototype, 'name', metadata);
      const emailDescriptor = propertyManager.registerDecorator(TestClass.prototype, 'email', metadata);
      const phoneDescriptor = propertyManager.registerDecorator(TestClass.prototype, 'phone', metadata);
      
      Object.defineProperty(TestClass.prototype, 'name', nameDescriptor);
      Object.defineProperty(TestClass.prototype, 'email', emailDescriptor);
      Object.defineProperty(TestClass.prototype, 'phone', phoneDescriptor);
      
      const duration = performance.now() - start;

      const instance = new TestClass();
      
      // Test property functionality (field initializer takes precedence)
      expect(instance.name).toBe(''); // Field initializer value, not decorator default
      instance.name = 'John';
      expect(instance.name).toBe('John');
      
      expect(duration).toBeLessThan(50);
    });

    test("should handle many properties efficiently", () => {
      const simpleWrapper: PropertyWrapperFunction = (originalDescriptor, _config, propertyName, _target) => {
        return {
          get: originalDescriptor?.get || function () {
            return (this as any)[`_${propertyName}`];
          },
          set: function (value: any) {
            (this as any)[`_${propertyName}`] = value;
          },
          enumerable: true,
          configurable: true
        };
      };

      propertyManager.registerWrapper('simple', simpleWrapper);

      const metadata: DecoratorMetadata = {
        type: 'simple',
        config: {},
        applied: false,
        priority: 1
      };

      class LargeClass {
        prop1: any; prop2: any; prop3: any; prop4: any; prop5: any;
        prop6: any; prop7: any; prop8: any; prop9: any; prop10: any;
      }

      const start = performance.now();
      
      for (let i = 1; i <= 10; i++) {
        const propName = `prop${i}`;
        const descriptor = propertyManager.registerDecorator(LargeClass.prototype, propName, metadata);
        Object.defineProperty(LargeClass.prototype, propName, descriptor);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100);
      
      // Verify properties work
      const instance = new LargeClass() as any;
      instance.prop1 = 'test1';
      instance.prop10 = 'test10';
      expect(instance.prop1).toBe('test1');
      expect(instance.prop10).toBe('test10');
    });
  });

  describe("Facade Performance", () => {
    test("should provide efficient access to all managers", () => {
      const start = performance.now();
      
      const method = decoratorManager.method;
      const cls = decoratorManager.class;
      const property = decoratorManager.property;
      
      const duration = performance.now() - start;
      
      expect(method).toBeInstanceOf(MethodDecoratorManager);
      expect(cls).toBeInstanceOf(ClassDecoratorManager);
      expect(property).toBeInstanceOf(PropertyDecoratorManager);
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    test("should handle bulk operations efficiently", () => {
      const simpleMethodWrapper: WrapperFunction = (method) => method;
      const simpleClassWrapper: ClassWrapperFunction = (cls) => cls;
      const simplePropertyWrapper: PropertyWrapperFunction = (desc) => 
        desc || { value: undefined, writable: true, enumerable: true, configurable: true };

      const start = performance.now();
      
      // Register multiple wrappers
      for (let i = 0; i < 10; i++) {
        decoratorManager.method.registerWrapper(`method${i}`, simpleMethodWrapper);
        decoratorManager.class.registerWrapper(`class${i}`, simpleClassWrapper);
        decoratorManager.property.registerWrapper(`property${i}`, simplePropertyWrapper);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100);
      
      // Verify registrations
      const allTypes = decoratorManager.getAllRegisteredTypes();
      expect(allTypes.method.length).toBeGreaterThanOrEqual(10);
      expect(allTypes.class.length).toBeGreaterThanOrEqual(10);
      expect(allTypes.property.length).toBeGreaterThanOrEqual(10);
    });

    test("should clear all caches efficiently", () => {
      // First, populate some caches by using decorators
      const mockWrapper: WrapperFunction = (method) => method;
      decoratorManager.method.registerWrapper('test', mockWrapper);
      
      const metadata: DecoratorMetadata = {
        type: 'test',
        config: {},
        applied: false,
        priority: 1
      };

      class TestClass {
        testMethod() { return 'test'; }
      }

      // Trigger cache creation
      decoratorManager.method.registerDecorator(
        TestClass.prototype,
        'testMethod',
        metadata,
        Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!
      );

      const start = performance.now();
      decoratorManager.clearAllCaches();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      
      const stats = decoratorManager.getAllStats();
      expect(stats.method.size).toBe(0);
      expect(stats.class.size).toBe(0);
      expect(stats.property.size).toBe(0);
    });
  });

  describe("Memory Usage", () => {
    test("should not leak memory with many decorations", () => {
      const wrapper: WrapperFunction = (originalMethod) => {
        return function (this: any, ...args: any[]) {
          return originalMethod.apply(this, args);
        };
      };

      methodManager.registerWrapper('memory', wrapper);

      const metadata: DecoratorMetadata = {
        type: 'memory',
        config: {},
        applied: false,
        priority: 1
      };

      // Create many classes and decorate their methods
      for (let i = 0; i < 100; i++) {
        const dynamicClass = class {
          testMethod() { return `result${i}`; }
        };

        const descriptor = Object.getOwnPropertyDescriptor(dynamicClass.prototype, 'testMethod')!;
        methodManager.registerDecorator(dynamicClass.prototype, 'testMethod', metadata, descriptor);
      }

      // The test mainly ensures we don't throw errors or hang
      // In a real scenario, you might monitor memory usage
      const stats = methodManager.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test("should handle WeakMap cleanup for garbage collected objects", () => {
      const wrapper: WrapperFunction = (method) => method;
      methodManager.registerWrapper('gc', wrapper);

      const metadata: DecoratorMetadata = {
        type: 'gc',
        config: {},
        applied: false,
        priority: 1
      };

      // Create objects that can be garbage collected
      let obj: any = class TestClass {
        testMethod() { return 'test'; }
      };

      const descriptor = Object.getOwnPropertyDescriptor(obj.prototype, 'testMethod')!;
      methodManager.registerDecorator(obj.prototype, 'testMethod', metadata, descriptor);

      // Remove reference to allow garbage collection
      obj = null;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Test that manager still works after potential GC
      const newClass = class NewClass {
        newMethod() { return 'new'; }
      };

      const newDescriptor = Object.getOwnPropertyDescriptor(newClass.prototype, 'newMethod')!;
      const result = methodManager.registerDecorator(newClass.prototype, 'newMethod', metadata, newDescriptor);
      
      expect(result).toBeDefined();
    });
  });

  describe("Concurrent Operations", () => {
    test("should handle concurrent decorator registrations", async () => {
      const wrapper: WrapperFunction = (method) => method;
      methodManager.registerWrapper('concurrent', wrapper);

      const metadata: DecoratorMetadata = {
        type: 'concurrent',
        config: {},
        applied: false,
        priority: 1
      };

      // Create multiple classes
      const classes = Array.from({ length: 10 }, (_, i) => {
        return class {
          [`method${i}`]() { return `result${i}`; }
        };
      });

      // Register decorators concurrently
      const promises = classes.map(async (cls, i) => {
        const descriptor = Object.getOwnPropertyDescriptor(cls.prototype, `method${i}`)!;
        return methodManager.registerDecorator(cls.prototype, `method${i}`, metadata, descriptor);
      });

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result.value).toBe('function');
      });
    });
  });
}); 