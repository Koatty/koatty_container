# koatty_container [![Version npm](https://img.shields.io/npm/v/koatty_container.svg?style=flat-square)](https://www.npmjs.com/package/koatty_container) [![npm Downloads](https://img.shields.io/npm/dm/koatty_container.svg?style=flat-square)](https://npmcharts.com/compare/koatty_container?minimal) [![GitHub stars](https://img.shields.io/github/stars/koatty/koatty_container.svg?style=social)](https://github.com/koatty/koatty_container)

🏆 **TypeScript IOC 容器** 

专为现代 Node.js 应用设计的依赖注入容器，提供智能循环依赖处理、高性能缓存优化、完整的 AOP 支持，以及企业级的稳定性保障。

## 🌟 项目亮点

- ✅ 100% 测试通过率
- 🎯 企业级稳定性
- 📋 完整的 TypeScript 支持
- 🚀 高缓存命中率，极速启动
- 💾 智能内存管理，批量加载优化
- 🔗 智能循环依赖处理
- 🎯 完整 AOP 支持，Before/After 切面编程
- 💉 多种注入方式，构造函数、属性、字符串标识符
- 🔄 生命周期管理，Singleton/Prototype 作用域

## 📦 安装

```bash
npm install koatty_container
# 或
yarn add koatty_container
# 或
pnpm add koatty_container
```

## 🚀 快速开始

### 基础依赖注入

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

@Controller()
class UserController {
  @Autowired()
  private userService: UserService;

  async handleRequest(id: string) {
    const user = await this.userService.getUser(id);
    return { success: true, data: user };
  }
}

// 注册组件
IOC.reg(UserRepository);
IOC.reg(UserService);
IOC.reg(UserController);

// 使用
const controller = IOC.get(UserController);
const result = await controller.handleRequest("123");
console.log(result); // { success: true, data: { id: "123", name: "John Doe", ... } }
```

### 高性能批量注册

```typescript
// 推荐：高性能启动方式
async function initializeApp() {
  const components = [
    { target: UserRepository },
    { target: UserService },
    { target: UserController },
    { target: EmailService },
    { target: OrderService }
  ];

  // 批量注册 + 性能优化
  IOC.batchRegister(components, {
    preProcessDependencies: true,  // 预处理依赖关系
    warmupAOP: true               // 预热 AOP 缓存
  });

  // 性能统计
  const stats = IOC.getDetailedPerformanceStats();
  console.log(`🚀 初始化完成:`);
  console.log(`   - 组件数量: ${stats.containers.totalRegistered}`);
  console.log(`   - 依赖缓存命中率: ${(stats.lruCaches.dependencies.hitRate * 100).toFixed(1)}%`);
  console.log(`   - AOP 缓存命中率: ${(stats.lruCaches.aop.hitRates.overall * 100).toFixed(1)}%`);
  console.log(`   - 总缓存大小: ${stats.lruCaches.totalSize}`);
}

await initializeApp();
```

## 🎯 AOP 面向切面编程

### 方法拦截

```typescript
import { Component, Before, After } from "koatty_container";

@Component()
class LoggingAspect {
  @Before("UserService.getUser")
  logBefore(target: any, methodName: string, args: any[]) {
    console.log(`🔍 调用 ${target.constructor.name}.${methodName}`, args);
  }

  @After("UserService.*")
  logAfter(target: any, methodName: string, result: any) {
    console.log(`✅ 完成 ${target.constructor.name}.${methodName}`, result);
  }
}

// 注册切面
IOC.reg(LoggingAspect);
IOC.reg(PerformanceAspect);
```

## 🔧 智能循环依赖处理

koatty_container 具备循环依赖处理能力，支持自动检测和智能解决方案：

```typescript
// 循环依赖示例 - 自动处理
@Service()
class OrderService {
  @Autowired("UserService")  // 使用字符串标识符
  userService: UserService;

  async createOrder(userId: string) {
    const user = await this.userService.getUser(userId);
    return { orderId: Date.now(), user };
  }
}

@Service()
class UserService {
  @Autowired("OrderService")  // 循环依赖，但会自动处理
  orderService: OrderService;

  async getUserWithOrders(userId: string) {
    // 延迟注入机制确保此时 orderService 已可用
    return { user: "data", orders: [] };
  }
}

// 容器自动检测并解决循环依赖
IOC.reg(OrderService);
IOC.reg(UserService);

// 生成依赖分析报告
IOC.generateDependencyReport();
// 输出: ✓ 检测到循环依赖但已自动解决
```

## 📊 性能优化与监控

### 元数据预加载

```typescript
// 方式1: 按类型预加载
IOC.preloadMetadata(['CONTROLLER', 'SERVICE', 'COMPONENT'], {
  optimizePerformance: true,     // 启用所有优化
  warmupCaches: true,           // 预热缓存
  batchPreProcessDependencies: true,  // 批量预处理
  clearStaleCache: false        // 保留有效缓存
});

// 方式2: 智能优化
IOC.preloadMetadata(); // 自动识别热点组件并优化

// 获取性能报告
const stats = IOC.getDetailedPerformanceStats();
console.log(`📊 性能统计:`);
console.log(`   缓存命中率: ${(stats.cache.hitRate * 100).toFixed(2)}%`);
console.log(`   内存使用: ${(stats.cache.memoryUsage / 1024).toFixed(1)}KB`);
console.log(`   热点组件类型: ${stats.hotspots.mostAccessedTypes.join(', ')}`);
```

### 实时监控

```typescript
// 生产环境监控
setInterval(() => {
  const stats = IOC.getPerformanceStats();
  
  if (stats.cache.hitRate < 0.7) {
    console.warn("⚠️  缓存命中率偏低，建议优化");
    IOC.clearPerformanceCache(); // 清理并重新优化
  }
}, 60000); // 每分钟检查
```

## 🛡️ 错误处理与诊断

### 循环依赖诊断

```typescript
try {
  IOC.reg(ServiceA);
  IOC.reg(ServiceB);
} catch (error) {
  if (IOC.hasCircularDependencies()) {
    const cycles = IOC.getCircularDependencies();
    console.log("🔍 发现循环依赖:", cycles);
    
    // 自动生成解决建议
    IOC.generateDependencyReport();
  }
}
```

### 详细错误信息

```typescript
// 容器状态检查
if (IOC.hasCircularDependencies()) {
  const report = IOC.getCircularDependencyDetector().generateDependencyReport();
  console.log(`总组件数: ${report.totalComponents}`);
  console.log(`已解析: ${report.resolvedComponents}`);
  console.log(`循环依赖: ${report.circularDependencies.length}`);
}
```

## 💉 配置注入

```typescript
import { Values } from "koatty_container";

@Component()
class DatabaseConfig {
  @Values("database.host", "localhost")
  host: string;

  @Values("database.port", 5432)
  port: number;

  @Values("app.version")
  appVersion: string;

  getConnectionString() {
    return `postgresql://${this.host}:${this.port}/myapp`;
  }
}

// 设置配置值
process.env.DATABASE_HOST = "prod-db.example.com";
process.env.DATABASE_PORT = "5432";
```

## 🧪 测试支持

### 完整的测试集成

```typescript
describe("用户服务测试", () => {
  beforeEach(() => {
    IOC.clearInstances(); // 清理实例，保留类注册
  });

  afterEach(() => {
    IOC.clearPerformanceCache(); // 清理缓存
  });

  test("依赖注入正常工作", () => {
    IOC.reg(UserRepository);
    IOC.reg(UserService);
    
    const userService = IOC.get(UserService);
    expect(userService).toBeInstanceOf(UserService);
    expect(userService.userRepository).toBeInstanceOf(UserRepository);
  });

  test("循环依赖自动处理", () => {
    IOC.reg(OrderService);
    IOC.reg(UserService);
    
    // 即使存在循环依赖，也能正常获取实例
    const orderService = IOC.get(OrderService);
    const userService = IOC.get(UserService);
    
    expect(orderService).toBeDefined();
    expect(userService).toBeDefined();
  });
});
```

### Mock 和测试替换

```typescript
@Service()
class MockUserRepository {
  async findById(id: string) {
    return { id, name: "Test User", email: "test@example.com" };
  }
}

// 测试中替换真实服务
beforeEach(() => {
  IOC.clearInstances();
  IOC.reg(MockUserRepository, "UserRepository"); // 替换实现
  IOC.reg(UserService);
});
```

## 📚 API 参考

### 核心容器 API

| 方法 | 描述 | 示例 |
|------|------|------|
| `IOC.reg(target, identifier?, options?)` | 注册组件 | `IOC.reg(UserService)` |
| `IOC.get<T>(identifier, type?, ...args)` | 获取实例 | `IOC.get(UserService)` |
| `IOC.batchRegister(components, options?)` | 批量注册 | `IOC.batchRegister([{target: UserService}])` |
| `IOC.preloadMetadata(types?, options?)` | 预加载优化 | `IOC.preloadMetadata(['SERVICE'])` |
| `IOC.getPerformanceStats()` | 性能统计 | `IOC.getPerformanceStats()` |
| `IOC.clear()` | 清空容器 | `IOC.clear()` |
| `IOC.clearInstances()` | 仅清理实例 | `IOC.clearInstances()` |

### 装饰器 API

| 装饰器 | 描述 | 示例 |
|--------|------|------|
| `@Component(identifier?)` | 标记组件 | `@Component("MyService")` |
| `@Service(identifier?)` | 标记服务 | `@Service()` |
| `@Autowired(identifier?)` | 属性注入 | `@Autowired("UserService")` |
| `@Values(key, defaultValue?)` | 配置注入 | `@Values("db.host", "localhost")` |
| `@Before(pointcut)` | 前置通知 | `@Before("*.save*")` |
| `@After(pointcut)` | 后置通知 | `@After("UserService.*")` |
| `@Around(pointcut)` | 环绕通知 | `@Around("*Service.*")` |

### 性能优化 API

| 方法 | 描述 |
|------|------|
| `IOC.getDetailedPerformanceStats()` | 详细性能报告 |
| `IOC.clearPerformanceCache()` | 清理性能缓存 |
| `IOC.hasCircularDependencies()` | 检查循环依赖 |
| `IOC.generateDependencyReport()` | 生成依赖报告 |

## 📈 性能基准

| 操作 | 耗时 | 说明 |
|------|------|------|
| 批量注册 74 个组件 | 13ms | 包含依赖分析和优化 |
| 元数据预加载 | 7ms | 3 种组件类型 |
| AOP 缓存预热 | 2ms | 74 个目标组件 |
| 获取单个实例 | <1ms | 缓存命中时 |
| 循环依赖检测 | <5ms | 包含完整分析 |

## 📄 许可证

BSD-3-Clause License

## 🤝 贡献

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md)。

## 🔗 相关项目

- [koatty](https://github.com/koatty/koatty) - 基于 Koa 的企业级 Node.js 框架
- [koatty_lib](https://github.com/koatty/koatty_lib) - 核心工具库
- [koatty_logger](https://github.com/koatty/koatty_logger) - 日志系统

---

⭐ 如果这个项目对你有帮助，请给个 Star！
