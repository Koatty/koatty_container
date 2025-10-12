# koatty_container [![Version npm](https://img.shields.io/npm/v/koatty_container.svg?style=flat-square)](https://www.npmjs.com/package/koatty_container) [![npm Downloads](https://img.shields.io/npm/dm/koatty_container.svg?style=flat-square)](https://npmcharts.com/compare/koatty_container?minimal) [![GitHub stars](https://img.shields.io/github/stars/koatty/koatty_container.svg?style=social)](https://github.com/koatty/koatty_container)

🏆 **TypeScript IOC Container + Decorator Management System**

A complete solution designed for modern Node.js applications, providing intelligent circular dependency handling, high-performance cache optimization, full AOP support, and **custom decorator management capabilities**.

[中文文档](./README_CN.md) | English

## 🌟 Key Features

- 🎯 **Custom Decorator Support** - Powerful decorator manager to easily extend your decorator ecosystem
- ✅ **100% Test Coverage** - 257 tests passed with complete code coverage
- 🚀 **High-Performance Cache** - WeakMap + LRU strategy for blazing fast startup and runtime
- 💾 **Smart Memory Management** - Automatic optimization to prevent memory leaks
- 🔗 **Intelligent Circular Dependency Handling** - Elegant solutions for complex dependency relationships
- 🎯 **Complete AOP Support** - Before/After/Around aspect-oriented programming
- 💉 **Multiple Injection Methods** - Constructor, property, and string identifier injection
- 📋 **Full TypeScript** - Type-safe with intelligent code completion

## 📦 Installation

```bash
npm install koatty_container
# or
yarn add koatty_container
# or
pnpm add koatty_container
```

## 🚀 IOC Container Features

### Basic Dependency Injection

```typescript
import { IOC, Autowired, Component, Service } from "koatty_container";

@Component()
class UserRepository {
  async findById(id: string) {
    return { id, name: "John Doe", email: "john@example.com" };
  }
}

@Service()
class UserService {
  @Autowired()
  private userRepository: UserRepository;

  async getUser(id: string) {
    return await this.userRepository.findById(id);
  }
}

@Component()
class UserController {
  @Autowired()
  private userService: UserService;

  async handleRequest(id: string) {
    const user = await this.userService.getUser(id);
    return { success: true, data: user };
  }
}

// Register components
IOC.reg(UserRepository);
IOC.reg(UserService);
IOC.reg(UserController);

// Usage
const controller = IOC.get(UserController);
const result = await controller.handleRequest("123");
```

### High-Performance Batch Registration

```typescript
async function initializeApp() {
  const components = [
    { target: UserRepository },
    { target: UserService },
    { target: UserController },
    { target: EmailService },
    { target: OrderService }
  ];

  // Batch registration with performance optimization
  IOC.batchRegister(components, {
    preProcessDependencies: true,  // Preprocess dependencies
    warmupAOP: true               // Warmup AOP cache
  });

  // Performance statistics
  const stats = IOC.getDetailedPerformanceStats();
  console.log(`🚀 Initialization completed:`);
  console.log(`   - Components: ${stats.containers.totalRegistered}`);
  console.log(`   - Dependency cache hit rate: ${(stats.lruCaches.dependencies.hitRate * 100).toFixed(1)}%`);
  console.log(`   - AOP cache hit rate: ${(stats.lruCaches.aop.hitRates.overall * 100).toFixed(1)}%`);
}

await initializeApp();
```

## 🎯 AOP (Aspect-Oriented Programming)

### Before 切面 - 前置拦截

```typescript
import { Aspect, IAspect, AspectContext, Before } from "koatty_container";

@Aspect()
export class LoggingAspect implements IAspect {
  app: any;
  
  async run(joinPoint: AspectContext): Promise<any> {
    const args = joinPoint.getArgs();
    const options = joinPoint.getOptions();
    console.log(`🔍 调用 ${options?.targetMethod}`, args);
    // Before 切面自动继续执行，不需要调用 executeProceed()
  }
}

@Component()
class OrderService {
  @Before(LoggingAspect, { level: 'info' })
  async createOrder(orderData: any) {
    return { orderId: Date.now(), ...orderData };
  }
}
```

### Around 切面 - 环绕通知

```typescript
@Aspect()
class TransactionAspect implements IAspect {
  app: any;
  
  async run(joinPoint: AspectContext): Promise<any> {
    const options = joinPoint.getOptions();
    console.log(`🔄 开始事务: ${options?.targetMethod}`);
    
    try {
      // ⚠️ Around 切面必须调用 executeProceed() 来执行原方法
      const result = await joinPoint.executeProceed();
      console.log(`✅ 提交事务: ${options?.targetMethod}`);
      return {
        ...result,
        transactionStatus: 'committed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.log(`❌ Transaction rolled back: ${options?.targetMethod}`, error);
      throw error;
    }
  }
}

@Component()
class UserService {
  @Around(TransactionAspect, { timeout: 5000 })
  async createUser(userData: any) {
    return { id: Date.now(), ...userData };
  }
}
```

### After 切面 - 后置拦截

```typescript
@Aspect()
class AuditAspect implements IAspect {
  app: any;
  
  async run(joinPoint: AspectContext): Promise<any> {
    // After 切面中，方法结果在 args[0] 中
    const result = joinPoint.getArgs()[0];
    const options = joinPoint.getOptions();
    console.log(`📝 审计日志 ${options?.targetMethod}:`, result);
    // After 切面不需要调用 executeProceed()
  }
}

@Component()
class PaymentService {
  @After(AuditAspect)
  async processPayment(amount: number) {
    return { success: true, amount, transactionId: Date.now() };
  }
}
```

### ⚠️ 重要：executeProceed() 安全保护

为防止误用，`executeProceed()` 只能在 Around/AroundEach 切面中调用：

| 切面类型 | 可否调用 executeProceed() | 说明 |
|---------|-------------------------|------|
| **Before** | ❌ 不可以 | 自动执行原方法，会抛出错误 |
| **BeforeEach** | ❌ 不可以 | 应用于所有方法，会抛出错误 |
| **After** | ❌ 不可以 | 在方法执行后运行，会抛出错误 |
| **AfterEach** | ❌ 不可以 | 应用于所有方法，会抛出错误 |
| **Around** | ✅ **必须调用** | 完全控制单个方法执行 |
| **AroundEach** | ✅ **必须调用** | 完全控制所有方法执行 |

```typescript
// ❌ 错误示例：在 Before 中调用 executeProceed()
@Before(WrongAspect)
class WrongAspect implements IAspect {
  app: any;
  async run(joinPoint: AspectContext): Promise<any> {
    // 这会抛出错误！
    return await joinPoint.executeProceed();
  }
}

// ✅ 正确示例：使用 hasProceed() 检查
@Aspect()
class SafeAspect implements IAspect {
  app: any;
  async run(joinPoint: AspectContext): Promise<any> {
    if (joinPoint.hasProceed()) {
      // Around 切面
      return await joinPoint.executeProceed();
    } else {
      // Before/After 切面
      console.log('Before/After logic');
    }
  }
}
```

### 切面叠加使用

多种切面可以叠加使用，形成强大的处理链：

```typescript
@Component()
@BeforeEach(LoggingAspect)   // 类级：所有方法前记录日志
@AfterEach(MetricsAspect)    // 类级：所有方法后收集指标
class OrderService {
  @Before(ValidationAspect)   // 方法级：参数验证
  @Around(TransactionAspect)  // 方法级：事务控制
  @After(NotificationAspect)  // 方法级：发送通知
  async createOrder(orderData: any) {
    return { orderId: Date.now(), ...orderData };
  }
}
```

**执行顺序：**
```
LoggingAspect (BeforeEach) → ValidationAspect (Before) → 
TransactionAspect (Around - 前) → 原方法 → TransactionAspect (Around - 后) →
NotificationAspect (After) → MetricsAspect (AfterEach)
```

**关键规则：**
- ✅ Before 修改的参数会传递给 Around 和原方法
- ✅ 每个切面的保护机制独立生效
- ✅ Around 必须调用 `executeProceed()` 来继续执行链

详细文档：[保护机制说明](./docs/PROTECTION_MECHANISM.md) | [接口简化说明](./docs/INTERFACE_SIMPLIFICATION.md)

## 🎨 自定义装饰器详解

### 1. Method Decorators - Enhance Method Behavior

```typescript
import { decoratorManager } from 'koatty_container';

// 1️⃣ Define decorator logic
const timingWrapper = (originalMethod: Function, config: any, methodName: string) => {
  return function (this: any, ...args: any[]) {
    const start = Date.now();
    console.log(`⏱️ Starting ${methodName}`);
    
    const result = originalMethod.apply(this, args);
    
    const duration = Date.now() - start;
    console.log(`✅ ${methodName} completed in ${duration}ms`);
    
    return result;
  };
};

// 2️⃣ Register the decorator
decoratorManager.method.registerWrapper('timing', timingWrapper);

// 3️⃣ Create decorator function
function Timing(enabled: boolean = true) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    return decoratorManager.method.registerDecorator(target, propertyKey, {
      type: 'timing',
      config: { enabled },
      applied: false,
      priority: 5 // Priority control
    }, descriptor);
  };
}

// 4️⃣ Use the custom decorator
class UserService {
  @Timing()
  async createUser(userData: any) {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return { id: Date.now(), ...userData };
  }
  
  @Timing(false) // Disable timing
  async getUser(id: string) {
    return { id, name: "John Doe" };
  }
}
```

### 2. Cache Decorator - Smart Result Caching

```typescript
// Advanced cache decorator example
const cacheWrapper = (originalMethod: Function, config: any, methodName: string) => {
  const cache = new Map();
  
  return function (this: any, ...args: any[]) {
    const cacheKey = config.keyGenerator ? 
      config.keyGenerator(args) : 
      JSON.stringify(args);
    
    // Check cache
    if (cache.has(cacheKey)) {
      console.log(`🎯 Cache hit: ${methodName}`);
      return cache.get(cacheKey);
    }
    
    // Execute original method
    const result = originalMethod.apply(this, args);
    
    // Handle async results
    if (result instanceof Promise) {
      return result.then(asyncResult => {
        cache.set(cacheKey, asyncResult);
        console.log(`💾 Cache stored: ${methodName}`);
        
        // TTL support
        if (config.ttl) {
          setTimeout(() => cache.delete(cacheKey), config.ttl * 1000);
        }
        
        return asyncResult;
      });
    }
    
    // Cache synchronous results
    cache.set(cacheKey, result);
    return result;
  };
};

decoratorManager.method.registerWrapper('cache', cacheWrapper);

function Cache(ttl?: number, keyGenerator?: (args: any[]) => string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    return decoratorManager.method.registerDecorator(target, propertyKey, {
      type: 'cache',
      config: { ttl, keyGenerator },
      applied: false,
      priority: 10 // High priority, execute first
    }, descriptor);
  };
}

// Use cache decorator
class DataService {
  @Cache(300, (args) => `user:${args[0]}`) // 5-minute TTL, custom key
  async getUserProfile(userId: string) {
    console.log(`📡 Loading user from database: ${userId}`);
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 200));
    return { id: userId, name: "John", email: "john@example.com" };
  }
}
```

### 3. Property Decorators - Property Behavior Enhancement

```typescript
// Property validation decorator
const validateWrapper = (originalDescriptor: PropertyDescriptor | undefined, config: any, propertyName: string) => {
  return {
    get: function () {
      const privateKey = `_${propertyName}`;
      if (!(privateKey in this)) {
        // Set default value
        (this as any)[privateKey] = config.defaultValue;
      }
      return (this as any)[privateKey];
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
      
      console.log(`✅ Property ${propertyName} set to:`, value);
      (this as any)[`_${propertyName}`] = value;
    },
    
    enumerable: true,
    configurable: true
  };
};

decoratorManager.property.registerWrapper('validate', validateWrapper);

function Validate(
  type?: string, 
  validators?: Array<{ fn: (value: any) => boolean; message: string }>,
  defaultValue?: any
) {
  return function (target: any, propertyKey: string) {
    return decoratorManager.property.registerDecorator(target, propertyKey, {
      wrapperTypes: ['validate'],
      config: { type, validators, defaultValue }
    });
  };
}

// Use property decorator
class User {
  @Validate('string', [
    { fn: (v: string) => v.length > 0, message: 'Name cannot be empty' },
    { fn: (v: string) => v.length < 50, message: 'Name length must be less than 50' }
  ], 'Anonymous')
  name: string;

  @Validate('number', [
    { fn: (v: number) => v >= 0, message: 'Age must be greater than or equal to 0' },
    { fn: (v: number) => v <= 150, message: 'Age must be less than or equal to 150' }
  ], 0)
  age: number;
}

// Usage example
const user = new User();
console.log(user.name); // "Anonymous" (default value)
user.age = 25; // ✅ Validation passed
// user.age = -5; // ❌ Throws error: Age must be greater than or equal to 0
```

### 4. Class Decorators - Class-Level Enhancement

```typescript
// Dependency injection decorator
const injectWrapper = (originalClass: Function, config: any) => {
  return class extends (originalClass as any) {
    constructor(...args: any[]) {
      super(...args);
      
      // Auto-inject dependencies
      for (const [key, dependency] of Object.entries(config.dependencies)) {
        (this as any)[key] = dependency;
      }
      
      console.log(`🔌 Dependencies injected for ${originalClass.name}:`, Object.keys(config.dependencies));
    }
  };
};

decoratorManager.class.registerWrapper('inject', injectWrapper);

function Injectable(dependencies: Record<string, any>) {
  return function (target: Function) {
    return decoratorManager.class.registerDecorator(target, {
      type: 'inject',
      config: { dependencies },
      applied: false,
      priority: 1
    });
  };
}

// Use class decorator
@Injectable({
  logger: { log: (msg: string) => console.log(`[LOG] ${msg}`) },
  config: { apiUrl: 'https://api.example.com', timeout: 5000 }
})
class ApiService {
  private logger: any;
  private config: any;
  
  async fetchData(endpoint: string) {
    this.logger.log(`Requesting: ${this.config.apiUrl}${endpoint}`);
    // API call logic
    return { data: 'success' };
  }
}
```

## 🔥 Advanced Features

### 1. Decorator Composition and Priority

```typescript
class OrderService {
  @Timing()           // Priority: 5
  @Cache(600)         // Priority: 10 (executes first)
  @RateLimit(100)     // Priority: 15 (executes earliest)
  async processOrder(orderData: any) {
    // Execution order: RateLimit -> Cache -> Timing -> Original method
    return { orderId: Date.now(), ...orderData };
  }
}
```

### 2. Conditional Decorators

```typescript
function ConditionalCache(condition: () => boolean, ttl: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!condition()) {
      return descriptor; // Condition not met, don't apply decorator
    }
    
    return decoratorManager.method.registerDecorator(target, propertyKey, {
      type: 'cache',
      config: { ttl },
      applied: false,
      priority: 8
    }, descriptor);
  };
}

class ProductService {
  @ConditionalCache(() => process.env.NODE_ENV === 'production', 600)
  async getProductList() {
    // Cache enabled only in production
    return await this.fetchProducts();
  }
}
```

### 3. Decorator Statistics and Monitoring

```typescript
// Get decorator usage statistics
const stats = decoratorManager.getComprehensiveStats();

console.log('📊 Decorator Statistics:');
console.log(`  Method decorators: ${stats.method.decoratedMethods}`);
console.log(`  Class decorators: ${stats.class.decoratedClasses}`);
console.log(`  Property decorators: ${stats.property.decoratedProperties}`);
console.log(`  Cache hit rate: ${stats.method.cacheStats.hitRate}%`);
console.log(`  Registered decorator types: ${stats.method.registeredTypes.join(', ')}`);

// Performance monitoring
const performance = decoratorManager.getPerformanceMetrics();
console.log('⚡ Performance Metrics:');
console.log(`  Average execution time: ${performance.averageExecutionTime}ms`);
console.log(`  Memory usage: ${performance.memoryUsage}MB`);
```

## 📊 Performance Data

### ⚡ Performance Metrics
- **Decorator registration**: < 1ms
- **Dependency injection**: < 5ms
- **AOP interception overhead**: < 0.1ms
- **Cache hit rate**: > 90%
- **Memory usage**: Optimized to minimum

### 📈 Scale Support
- **Component count**: Supports 10,000+ components
- **Decorator chains**: Supports 50+ decorator combinations
- **Concurrent requests**: Supports high-concurrency scenarios
- **Memory management**: Automatic garbage collection optimization

## 🛠️ API Reference

### DecoratorManager Core API

```typescript
interface DecoratorManager {
  // Method decorator manager
  method: {
    registerWrapper(type: string, wrapper: MethodWrapperFunction): void;
    registerDecorator(target: any, propertyKey: string, metadata: DecoratorMetadata, descriptor: PropertyDescriptor): PropertyDescriptor;
    unregisterWrapper(type: string): boolean;
    hasWrapper(type: string): boolean;
    getRegisteredTypes(): string[];
    clearCache(): void;
    getCacheStats(): CacheStats;
  };
  
  // Class decorator manager
  class: {
    registerWrapper(type: string, wrapper: ClassWrapperFunction): void;
    registerDecorator(target: Function, metadata: DecoratorMetadata): Function;
    trackInstance(instance: any): void;
    getDecoratedClasses(): Function[];
  };
  
  // Property decorator manager
  property: {
    registerWrapper(type: string, wrapper: PropertyWrapperFunction): void;
    registerDecorator(target: any, propertyKey: string, metadata: PropertyDecoratorMetadata): PropertyDescriptor;
    getPropertyWrapper(target: any, propertyKey: string): PropertyWrapper | undefined;
    getDecoratedProperties(): Array<{ target: any; propertyKey: string; metadata: PropertyDecoratorMetadata }>;
  };
  
  // Unified management
  clearAllCaches(): void;
  getComprehensiveStats(): ComprehensiveStats;
  hasWrapper(type: string): boolean;
  getAllRegisteredTypes(): { method: string[]; class: string[]; property: string[] };
}
```

## 🌟 Real-World Example

```typescript
// 1. Define custom decorators
@Injectable({ database: new DatabaseConnection(), logger: new Logger() })
class UserService {
  @Cache(300)
  @Timing()
  @RateLimit(100, 60) // 100 requests per minute
  async getUser(@Validate('string') userId: string) {
    return await this.database.findUser(userId);
  }
  
  @Transaction({ isolationLevel: 'READ_COMMITTED' })
  @Audit('USER_CREATION', { includeDetails: true })
  async createUser(@Validate('object') userData: UserData) {
    return await this.database.createUser(userData);
  }
}

// 2. Property validation
class UserProfile {
  @Validate('string', [
    { fn: (v) => v.length > 0, message: 'Username cannot be empty' },
    { fn: (v) => /^[a-zA-Z0-9_]+$/.test(v), message: 'Username can only contain letters, numbers and underscores' }
  ])
  username: string;
  
  @Validate('string', [
    { fn: (v) => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v), message: 'Invalid email format' }
  ])
  email: string;
  
  @Validate('number', [
    { fn: (v) => v >= 18, message: 'Age must be at least 18' }
  ], 18)
  age: number;
}

// 3. Use the system
const userService = IOC.get(UserService);
const user = await userService.getUser('123'); // Auto cache, timing, rate limiting

const profile = new UserProfile();
profile.username = 'john_doe';    // ✅ Validation passed
profile.email = 'john@example.com'; // ✅ Validation passed
// profile.age = 15;              // ❌ Validation failed
```

## 📄 License

BSD-3 License - See [LICENSE](LICENSE) file for details

## 🔗 Links

- [GitHub Repository](https://github.com/koatty/koatty_container)
- [npm Package](https://www.npmjs.com/package/koatty_container)
- [API Documentation](https://koatty.github.io/koatty_container)
- [Changelog](https://github.com/koatty/koatty_container/releases)

---

**⭐ If this project helps you, please give us a Star!**
