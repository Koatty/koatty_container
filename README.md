# koatty_container [![Version npm](https://img.shields.io/npm/v/koatty_container.svg?style=flat-square)](https://www.npmjs.com/package/koatty_container) [![npm Downloads](https://img.shields.io/npm/dm/koatty_container.svg?style=flat-square)](https://npmcharts.com/compare/koatty_container?minimal) [![GitHub stars](https://img.shields.io/github/stars/koatty/koatty_container.svg?style=social)](https://github.com/koatty/koatty_container)

🏆 **TypeScript IOC Container + Decorator Management System**

A complete solution designed for modern Node.js applications, providing intelligent circular dependency handling, high-performance cache optimization, full AOP support, and **custom decorator management capabilities**.

[中文文档](./README_CN.md) | English

## ⚠️ Important Notice (v2.0.0+)

**Architecture Improvement**: The `@Component` decorator has been moved to `koatty_core` package for better separation of concerns:

- **koatty_container** (IOC Layer): Provides dependency injection infrastructure (`@Autowired`, `@Value`, `@Aspect`, `IOC.saveClass()`)
- **koatty_core** (Framework Layer): Provides application-level decorators (`@Component`, `@Controller`, `@Service`, `@Middleware`)

**Migration Guide**:
```typescript
// ❌ Old (deprecated)
import { Component } from "koatty_container";

// ✅ New (recommended)
import { Component } from "koatty_core";
// or if using koatty framework
import { Component } from "koatty";
```

For standalone usage without koatty_core, use `IOC.saveClass()` directly:
```typescript
import { IOC } from "koatty_container";

class MyClass {}
IOC.saveClass("COMPONENT", MyClass, "MyClass");
```

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

### Method Interception

```typescript
@Aspect()
export class LoggingAspect implements IAspect {
  async run(args: any[], target?: any, options?: any): Promise<any> {
    console.log(`🔍 Calling ${options?.targetMethod}`, args);
    return Promise.resolve();
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

### Around Advice

```typescript
@Aspect()
class TransactionAspect {
  async run(args: any[], proceed: Function, options?: any): Promise<any> {
    console.log(`🔄 Starting transaction: ${options?.targetMethod}`);
    
    try {
      const result = await proceed(args);
      console.log(`✅ Transaction committed: ${options?.targetMethod}`);
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

## 🎨 Custom Decorators Guide

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
