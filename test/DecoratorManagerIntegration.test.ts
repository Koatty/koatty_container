import assert from "assert";
import { decoratorManager } from "../src/manager/index";
import type { DecoratorMetadata } from "../src/manager/index";

describe("DecoratorManager Integration Tests", () => {
  beforeEach(() => {
    // Clear all caches before each test
    decoratorManager.clearAllCaches();
  });

  describe("Real-world Scenarios", () => {
    test("should implement a complete logging and caching system", () => {
      // Setup logging wrapper
      const logs: string[] = [];
      const loggingWrapper = (originalMethod: Function, config: any, methodName: string, _target: unknown) => {
        return function (this: any, ...args: any[]) {
          const startTime = Date.now();
          logs.push(`[${config.level || 'INFO'}] Entering ${methodName} with args: ${JSON.stringify(args)}`);
          
          try {
            const result = originalMethod.apply(this, args);
            const duration = Date.now() - startTime;
            logs.push(`[${config.level || 'INFO'}] Exiting ${methodName} after ${duration}ms with result: ${JSON.stringify(result)}`);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            logs.push(`[ERROR] ${methodName} failed after ${duration}ms: ${error}`);
            throw error;
          }
        };
      };

      // Setup caching wrapper
      const cache = new Map<string, any>();
      const cachingWrapper = (originalMethod: Function, config: any, methodName: string, _target: unknown) => {
        return function (this: any, ...args: any[]) {
          const cacheKey = `${methodName}:${JSON.stringify(args)}`;
          
          if (config.enabled && cache.has(cacheKey)) {
            logs.push(`[CACHE] Cache hit for ${methodName}`);
            return cache.get(cacheKey);
          }
          
          const result = originalMethod.apply(this, args);
          
          if (config.enabled) {
            cache.set(cacheKey, result);
            logs.push(`[CACHE] Cached result for ${methodName}`);
          }
          
          return result;
        };
      };

      // Setup dependency injection wrapper
      const dependencyWrapper = (originalClass: Function, config: any, _className: string) => {
        return class extends (originalClass as any) {
          constructor(...args: any[]) {
            super(...args);
            
            // Inject dependencies
            if (config.dependencies) {
              Object.entries(config.dependencies).forEach(([key, value]) => {
                (this as any)[key] = value;
              });
            }
          }
        };
      };

      // Setup validation wrapper
      const validationWrapper = (originalDescriptor: PropertyDescriptor | undefined, config: any, propertyName: string, _target: unknown) => {
        return {
          get: originalDescriptor?.get || function () {
            return (this as any)[`_${propertyName}`] ?? config.defaultValue;
          },
          set: function (value: any) {
            // Type validation
            if (config.type && typeof value !== config.type) {
              throw new Error(`Property ${propertyName} must be of type ${config.type}`);
            }
            
            // Custom validators
            if (config.validators) {
              for (const validator of config.validators) {
                if (!validator.fn(value)) {
                  throw new Error(`Property ${propertyName} validation failed: ${validator.message}`);
                }
              }
            }
            
            (this as any)[`_${propertyName}`] = value;
            
            if (originalDescriptor?.set) {
              originalDescriptor.set.call(this, value);
            }
          },
          enumerable: true,
          configurable: true
        };
      };

      // Register all wrappers
      decoratorManager.method.registerWrapper('logging', loggingWrapper);
      decoratorManager.method.registerWrapper('caching', cachingWrapper);
      decoratorManager.class.registerWrapper('inject', dependencyWrapper);
      decoratorManager.property.registerWrapper('validate', validationWrapper);

      // Create decorator functions
      function Log(level: string = 'INFO') {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const metadata: DecoratorMetadata = {
            type: 'logging',
            config: { level },
            applied: false,
            priority: 10 // High priority
          };
          return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
        };
      }

      function Cache(enabled: boolean = true) {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const metadata: DecoratorMetadata = {
            type: 'caching',
            config: { enabled },
            applied: false,
            priority: 1 // Low priority (should execute after logging)
          };
          return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
        };
      }

      function Injectable(dependencies: Record<string, any>) {
        return function <T extends { new (...args: any[]): any }>(constructor: T) {
          const metadata: DecoratorMetadata = {
            type: 'inject',
            config: { dependencies },
            applied: false,
            priority: 1
          };
          return decoratorManager.class.registerDecorator(constructor, metadata) as T;
        };
      }

      function Validate(type?: string, validators?: Array<{ fn: (value: any) => boolean; message: string }>, defaultValue?: any) {
        return function (target: any, propertyKey: string) {
          const metadata: DecoratorMetadata = {
            type: 'validate',
            config: { type, validators, defaultValue },
            applied: false,
            priority: 1
          };
          const descriptor = decoratorManager.property.registerDecorator(target, propertyKey, metadata);
          Object.defineProperty(target, propertyKey, descriptor);
        };
      }

      // Create a complete service class using all decorators
      @Injectable({
        logger: { log: (msg: string) => logs.push(`[SERVICE] ${msg}`) },
        config: { apiUrl: 'https://api.example.com', timeout: 5000 }
      })
      class UserService {
        @Validate('string', [
          { fn: (v: string) => v.length > 0, message: 'Name cannot be empty' },
          { fn: (v: string) => v.length < 50, message: 'Name too long' }
        ], 'Anonymous')
        public name: string = '';

        @Validate('number', [
          { fn: (v: number) => v >= 0, message: 'Age must be positive' },
          { fn: (v: number) => v < 150, message: 'Age must be realistic' }
        ], 0)
        public age: number = 0;

        private logger: any;
        private config: any;

        @Log('DEBUG')
        @Cache(true)
        public async getUserById(id: number): Promise<{ id: number; name: string }> {
          this.logger.log(`Fetching user ${id} from ${this.config.apiUrl}`);
          
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 10));
          
          return { id, name: `User${id}` };
        }

        @Log('INFO')
        @Cache(false) // Don't cache mutations
        public async updateUser(id: number, data: { name?: string; age?: number }): Promise<boolean> {
          this.logger.log(`Updating user ${id} with data: ${JSON.stringify(data)}`);
          
          // Simulate update
          await new Promise(resolve => setTimeout(resolve, 5));
          
          return true;
        }

        @Log('WARN')
        public validateUserData(userData: any): boolean {
          if (!userData.name || userData.age < 0) {
            throw new Error('Invalid user data');
          }
          return true;
        }
      }

      // Test the complete system
      const userService = new UserService();

      // Test dependency injection
      expect(userService).toHaveProperty('logger');
      expect(userService).toHaveProperty('config');
      expect((userService as any).config.apiUrl).toBe('https://api.example.com');

      // Test property values (field initializers take precedence over decorator defaults)
      expect(userService.name).toBe(''); // Field initializer value, not decorator default
      expect(userService.age).toBe(0); // Field initializer value (same as decorator default)

      userService.name = 'John Doe';
      userService.age = 30;
      expect(userService.name).toBe('John Doe');
      expect(userService.age).toBe(30);

      // Test validation errors
      // Delete instance property to access decorator setter
      delete (userService as any).name;
      expect(() => {
        userService.name = ''; // Should fail validation
      }).toThrow('Name cannot be empty');

      // Delete instance property to access decorator setter
      delete (userService as any).age;
      expect(() => {
        userService.age = -5; // Should fail validation
      }).toThrow('Age must be positive');

      // Test method decorators - async methods
      return userService.getUserById(123).then(result => {
        expect(result).toEqual({ id: 123, name: 'User123' });
        
        // Verify logging occurred
        const debugLogs = logs.filter(log => log.includes('[DEBUG]'));
        expect(debugLogs.length).toBeGreaterThan(0);
        
        // Test caching - call the same method again
        return userService.getUserById(123);
      }).then(cachedResult => {
        expect(cachedResult).toEqual({ id: 123, name: 'User123' });
        
        // Verify cache hit
        const cacheLogs = logs.filter(log => log.includes('[CACHE] Cache hit'));
        expect(cacheLogs.length).toBeGreaterThan(0);
        
        // Test update method (no caching)
        return userService.updateUser(123, { name: 'Jane Doe' });
      }).then(updateResult => {
        expect(updateResult).toBe(true);
        
        // Verify INFO level logging
        const infoLogs = logs.filter(log => log.includes('[INFO]'));
        expect(infoLogs.length).toBeGreaterThan(0);
        
        // Test validation method with error
        expect(() => {
          userService.validateUserData({ name: '', age: -1 });
        }).toThrow('Invalid user data');
        
        // Verify WARN level logging
        const warnLogs = logs.filter(log => log.includes('[WARN]'));
        expect(warnLogs.length).toBeGreaterThan(0);
      });
    });

    test("should implement AOP-style cross-cutting concerns", () => {
      const auditLog: Array<{ action: string; timestamp: number; user: string; details: any }> = [];
      const performanceMetrics: Array<{ method: string; duration: number; timestamp: number }> = [];

      // Audit wrapper
      const auditWrapper = (originalMethod: Function, config: any, methodName: string, target: unknown) => {
        return function (this: any, ...args: any[]) {
          const startTime = Date.now();
          const user = config.user || 'system';
          
          auditLog.push({
            action: `${methodName}_start`,
            timestamp: startTime,
            user,
            details: { args: config.logArgs ? args : undefined }
          });
          
          try {
            const result = originalMethod.apply(this, args);
            
            if (result && typeof result.then === 'function') {
              // Handle async methods
              return result.then((res: any) => {
                auditLog.push({
                  action: `${methodName}_success`,
                  timestamp: Date.now(),
                  user,
                  details: { result: config.logResult ? res : undefined }
                });
                return res;
              }).catch((error: any) => {
                auditLog.push({
                  action: `${methodName}_error`,
                  timestamp: Date.now(),
                  user,
                  details: { error: error.message }
                });
                throw error;
              });
            } else {
              // Handle sync methods
              auditLog.push({
                action: `${methodName}_success`,
                timestamp: Date.now(),
                user,
                details: { result: config.logResult ? result : undefined }
              });
              return result;
            }
          } catch (error: any) {
            auditLog.push({
              action: `${methodName}_error`,
              timestamp: Date.now(),
              user,
              details: { error: error.message }
            });
            throw error;
          }
        };
      };

      // Performance monitoring wrapper
      const performanceWrapper = (originalMethod: Function, config: any, methodName: string, _target: unknown) => {
        return function (this: any, ...args: any[]) {
          const startTime = performance.now();
          
          try {
            const result = originalMethod.apply(this, args);
            
            if (result && typeof result.then === 'function') {
              // Handle async methods
              return result.then((res: any) => {
                const duration = performance.now() - startTime;
                performanceMetrics.push({
                  method: methodName,
                  duration,
                  timestamp: Date.now()
                });
                return res;
              }).catch((error: any) => {
                const duration = performance.now() - startTime;
                performanceMetrics.push({
                  method: methodName,
                  duration,
                  timestamp: Date.now()
                });
                throw error;
              });
            } else {
              // Handle sync methods
              const duration = performance.now() - startTime;
              performanceMetrics.push({
                method: methodName,
                duration,
                timestamp: Date.now()
              });
              return result;
            }
          } catch (error) {
            const duration = performance.now() - startTime;
            performanceMetrics.push({
              method: methodName,
              duration,
              timestamp: Date.now()
            });
            throw error;
          }
        };
      };

      // Rate limiting wrapper
      const rateLimitWrapper = (originalMethod: Function, config: any, methodName: string, _target: unknown) => {
        const calls = new Map<string, number[]>();
        
        return function (this: any, ...args: any[]) {
          // Use first argument as key if available (e.g., accountId), otherwise use config.key or 'default'
          const key = config.key || (args.length > 0 ? String(args[0]) : 'default');
          const limit = config.limit || 10;
          const window = config.window || 60000; // 1 minute
          const now = Date.now();
          
          // Clean old calls
          if (!calls.has(key)) {
            calls.set(key, []);
          }
          
          const callTimes = calls.get(key)!;
          const recentCalls = callTimes.filter(time => now - time < window);
          
          if (recentCalls.length >= limit) {
            throw new Error(`Rate limit exceeded for ${methodName}. Max ${limit} calls per ${window}ms`);
          }
          
          recentCalls.push(now);
          calls.set(key, recentCalls);
          
          return originalMethod.apply(this, args);
        };
      };

      // Register wrappers
      decoratorManager.method.registerWrapper('audit', auditWrapper);
      decoratorManager.method.registerWrapper('performance', performanceWrapper);
      decoratorManager.method.registerWrapper('rateLimit', rateLimitWrapper);

      // Create decorator functions
      function Audit(user: string = 'system', logArgs: boolean = false, logResult: boolean = false) {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const metadata: DecoratorMetadata = {
            type: 'audit',
            config: { user, logArgs, logResult },
            applied: false,
            priority: 5
          };
          return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
        };
      }

      function Performance() {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const metadata: DecoratorMetadata = {
            type: 'performance',
            config: {},
            applied: false,
            priority: 3
          };
          return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
        };
      }

      function RateLimit(limit: number = 5, window: number = 60000, key?: string) {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const metadata: DecoratorMetadata = {
            type: 'rateLimit',
            config: { limit, window, key },
            applied: false,
            priority: 10 // Highest priority - should execute first
          };
          return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
        };
      }

      // Create a service with cross-cutting concerns
      class BankingService {
        @Audit('admin', true, false)
        @Performance()
        @RateLimit(3, 5000) // Max 3 calls per 5 seconds
        public withdrawMoney(accountId: string, amount: number): boolean {
          if (amount <= 0) {
            throw new Error('Invalid amount');
          }
          
          // Simulate withdrawal logic
          return true;
        }

        @Audit('user', false, true)
        @Performance()
        public async checkBalance(accountId: string): Promise<number> {
          // Simulate async database call
          await new Promise(resolve => setTimeout(resolve, 50));
          return Math.random() * 10000;
        }

        @Audit('system', true, true)
        @Performance()
        public transfer(fromAccount: string, toAccount: string, amount: number): boolean {
          if (amount <= 0 || fromAccount === toAccount) {
            throw new Error('Invalid transfer parameters');
          }
          return true;
        }
      }

      const bankingService = new BankingService();

      // Test normal operations
      const result1 = bankingService.withdrawMoney('acc123', 100);
      expect(result1).toBe(true);

      const result2 = bankingService.transfer('acc123', 'acc456', 50);
      expect(result2).toBe(true);

      // Test async operation
      return bankingService.checkBalance('acc123').then(balance => {
        expect(typeof balance).toBe('number');
        
        // Verify audit logs
        expect(auditLog.length).toBeGreaterThan(0);
        const withdrawAudit = auditLog.find(log => log.action === 'withdrawMoney_start');
        expect(withdrawAudit).toBeTruthy();
        expect(withdrawAudit!.user).toBe('admin');
        
        const transferAudit = auditLog.find(log => log.action === 'transfer_success');
        expect(transferAudit).toBeTruthy();
        expect(transferAudit!.user).toBe('system');
        
        const balanceAudit = auditLog.find(log => log.action === 'checkBalance_success');
        expect(balanceAudit).toBeTruthy();
        expect(balanceAudit!.user).toBe('user');
        
        // Verify performance metrics
        expect(performanceMetrics.length).toBeGreaterThanOrEqual(3);
        const withdrawMetric = performanceMetrics.find(m => m.method === 'withdrawMoney');
        const transferMetric = performanceMetrics.find(m => m.method === 'transfer');
        const balanceMetric = performanceMetrics.find(m => m.method === 'checkBalance');
        
        expect(withdrawMetric).toBeTruthy();
        expect(transferMetric).toBeTruthy();
        expect(balanceMetric).toBeTruthy();
        expect(balanceMetric!.duration).toBeGreaterThan(45); // Should take at least 50ms due to setTimeout
        
        // Test rate limiting
        bankingService.withdrawMoney('acc123', 25); // 2nd call
        bankingService.withdrawMoney('acc123', 75); // 3rd call
        
        // 4th call should fail due to rate limit
        expect(() => {
          bankingService.withdrawMoney('acc123', 10);
        }).toThrow('Rate limit exceeded');
        
        // Test error handling with different account - should hit validation before rate limit
        expect(() => {
          bankingService.withdrawMoney('acc456', -50); // Use different account
        }).toThrow('Invalid amount');
        
        // Verify error was audited (should be rate limit error)
        const errorAudit = auditLog.find(log => log.action === 'withdrawMoney_error');
        expect(errorAudit).toBeTruthy();
        expect(errorAudit!.details.error).toContain('Rate limit exceeded');
      });
    });

    test("should handle complex inheritance scenarios", () => {
      // Base class with decorators
      const timingWrapper = (originalMethod: Function, _config: any, methodName: string, _target: unknown) => {
        return function (this: any, ...args: any[]) {
          const start = Date.now();
          const result = originalMethod.apply(this, args);
          const duration = Date.now() - start;
          return { result, timing: duration, method: methodName };
        };
      };

      const loggingWrapper = (originalMethod: Function, config: any, methodName: string, _target: unknown) => {
        return function (this: any, ...args: any[]) {
          if (config.before) {
            console.log(`Before ${methodName}`);
          }
          const result = originalMethod.apply(this, args);
          if (config.after) {
            console.log(`After ${methodName}`);
          }
          return result;
        };
      };

      decoratorManager.method.registerWrapper('timing', timingWrapper);
      decoratorManager.method.registerWrapper('logging', loggingWrapper);

      function Timing() {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const metadata: DecoratorMetadata = {
            type: 'timing',
            config: {},
            applied: false,
            priority: 1
          };
          return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
        };
      }

      function Log(before: boolean = true, after: boolean = true) {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const metadata: DecoratorMetadata = {
            type: 'logging',
            config: { before, after },
            applied: false,
            priority: 2
          };
          return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
        };
      }

      // Base class
      class BaseService {
        @Timing()
        public baseMethod(): string {
          return 'base';
        }

        @Log(true, false)
        public sharedMethod(): string {
          return 'shared';
        }
      }

      // Derived class
      class DerivedService extends BaseService {
        @Timing()
        @Log(false, true)
        public derivedMethod(): string {
          return 'derived';
        }

        // Override base method with additional decorator
        @Log(true, true)
        public sharedMethod(): string {
          return `derived_${super.sharedMethod()}`;
        }
      }

      // Further derived class
      class SpecializedService extends DerivedService {
        @Timing()
        public specializedMethod(): string {
          return 'specialized';
        }

        // Override with different decorator config
        @Log(false, false)
        public derivedMethod(): string {
          const superResult = super.derivedMethod() as any;
          // If super returns an object with result property (due to decorators), extract the result
          const baseResult = typeof superResult === 'object' && superResult.result ? superResult.result : superResult;
          return `special_${baseResult}`;
        }
      }

      const baseService = new BaseService();
      const derivedService = new DerivedService();
      const specializedService = new SpecializedService();

      // Test base service
      const baseResult = baseService.baseMethod() as any;
      expect(baseResult.result).toBe('base');
      expect(baseResult.timing).toBeGreaterThanOrEqual(0);
      expect(baseResult.method).toBe('baseMethod');

      // Test derived service
      const derivedResult = derivedService.derivedMethod() as any;
      expect(derivedResult.result).toBe('derived');
      expect(derivedResult.timing).toBeGreaterThanOrEqual(0);

      // Test method override
      const sharedResult = derivedService.sharedMethod();
      expect(sharedResult).toBe('derived_shared');

      // Test specialized service
      const specializedResult = specializedService.specializedMethod() as any;
      expect(specializedResult.result).toBe('specialized');

      const overriddenResult = specializedService.derivedMethod();
      expect(overriddenResult).toBe('special_derived');
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle wrapper registration errors gracefully", () => {
      // Register a wrapper that throws during registration
      const faultyWrapper = () => {
        throw new Error('Wrapper registration failed');
      };

      expect(() => {
        decoratorManager.method.registerWrapper('faulty', faultyWrapper as any);
      }).not.toThrow(); // Registration should not throw

      expect(decoratorManager.method.hasWrapper('faulty')).toBe(true);
    });

    test("should handle wrapper execution errors gracefully", () => {
      // Register a wrapper that throws during execution
      const errorWrapper = (originalMethod: Function, _config: any, _methodName: string, _target: unknown) => {
        throw new Error('Wrapper execution failed');
      };

      decoratorManager.method.registerWrapper('error', errorWrapper);

      class TestClass {
        testMethod(): string {
          return 'original';
        }
      }

      const metadata: DecoratorMetadata = {
        type: 'error',
        config: {},
        applied: false,
        priority: 1
      };

      // Should not throw during decorator registration
      expect(() => {
        const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!;
        decoratorManager.method.registerDecorator(TestClass.prototype, 'testMethod', metadata, descriptor);
      }).not.toThrow();
    });

    test("should handle missing wrapper functions", () => {
      class TestClass {
        testMethod(): string {
          return 'test';
        }
      }

      const metadata: DecoratorMetadata = {
        type: 'nonexistent',
        config: {},
        applied: false,
        priority: 1
      };

      const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!;
      const result = decoratorManager.method.registerDecorator(TestClass.prototype, 'testMethod', metadata, descriptor);

      // Should return original descriptor when wrapper doesn't exist
      expect(result.value).toBe(descriptor.value);
    });

    test("should handle circular dependencies in wrappers", () => {
      let callCount = 0;

      const circularWrapper = (originalMethod: Function, _config: any, _methodName: string, _target: unknown) => {
        return function (this: any, ...args: any[]) {
          callCount++;
          if (callCount > 10) {
            throw new Error('Circular dependency detected');
          }
          return originalMethod.apply(this, args);
        };
      };

      decoratorManager.method.registerWrapper('circular', circularWrapper);

      class TestClass {
        testMethod(): string {
          return 'test';
        }
      }

      const metadata: DecoratorMetadata = {
        type: 'circular',
        config: {},
        applied: false,
        priority: 1
      };

      const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!;
      const wrappedDescriptor = decoratorManager.method.registerDecorator(TestClass.prototype, 'testMethod', metadata, descriptor);
      TestClass.prototype.testMethod = wrappedDescriptor.value;

      const instance = new TestClass();
      const result = instance.testMethod();

      expect(result).toBe('test');
      expect(callCount).toBe(1);
    });
  });

  describe("Performance Edge Cases", () => {
    test("should handle deep decorator nesting", () => {
      // Create 20 different wrappers
      for (let i = 0; i < 20; i++) {
        const wrapper = (originalMethod: Function, _config: any, _methodName: string, _target: unknown) => {
          return function (this: any, ...args: any[]) {
            const result = originalMethod.apply(this, args);
            return `wrapper${i}(${result})`;
          };
        };
        decoratorManager.method.registerWrapper(`wrapper${i}`, wrapper);
      }

      class TestClass {
        testMethod(): string {
          return 'original';
        }
      }

      // Apply all 20 decorators
      let descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!;
      
      for (let i = 0; i < 20; i++) {
        const metadata: DecoratorMetadata = {
          type: `wrapper${i}`,
          config: {},
          applied: false,
          priority: i
        };
        descriptor = decoratorManager.method.registerDecorator(TestClass.prototype, 'testMethod', metadata, descriptor);
      }

      TestClass.prototype.testMethod = descriptor.value;

      const instance = new TestClass();
      const result = instance.testMethod();

      // Should contain all wrappers (order may vary based on priority)
      expect(typeof result).toBe('string');
      expect(result).toContain('original');
      expect(result).toContain('wrapper0');
      expect(result).toContain('wrapper19');
    });

    test("should handle large objects in decorator configs", () => {
      const largeConfig = {
        data: new Array(10000).fill(0).map((_, i) => ({ id: i, value: `item${i}` })),
        metadata: {
          created: new Date(),
          version: '1.0.0',
          description: 'A'.repeat(10000) // Large string
        }
      };

      const configWrapper = (originalMethod: Function, config: any, _methodName: string, _target: unknown) => {
        return function (this: any, ...args: any[]) {
          const result = originalMethod.apply(this, args);
          return { result, configSize: JSON.stringify(config).length };
        };
      };

      decoratorManager.method.registerWrapper('config', configWrapper);

      class TestClass {
        testMethod(): string {
          return 'test';
        }
      }

      const metadata: DecoratorMetadata = {
        type: 'config',
        config: largeConfig,
        applied: false,
        priority: 1
      };

      const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!;
      const wrappedDescriptor = decoratorManager.method.registerDecorator(TestClass.prototype, 'testMethod', metadata, descriptor);
      TestClass.prototype.testMethod = wrappedDescriptor.value;

      const instance = new TestClass();
      const result = instance.testMethod() as any;

      expect(result.result).toBe('test');
      expect(result.configSize).toBeGreaterThan(100000); // Should handle large configs
    });
  });
}); 