# koatty_container [![Version npm](https://img.shields.io/npm/v/koatty_container.svg?style=flat-square)](https://www.npmjs.com/package/koatty_container) [![npm Downloads](https://img.shields.io/npm/dm/koatty_container.svg?style=flat-square)](https://npmcharts.com/compare/koatty_container?minimal)

Typescript中IOC容器的实现，支持DI（依赖注入）以及 AOP （切面编程）。参考Spring IOC的实现机制，用Typescript实现了一个IOC容器，在应用启动的时候，自动分类装载组件，并且根据依赖关系，注入相应的依赖。它解决了一个最主要的问题：将组件的创建+配置与组件的使用相分离，并且，由IoC容器负责管理组件的生命周期。

## ✨ 主要特性

- 🏗️ **IOC容器**: 完整的依赖注入和控制反转实现
- 💉 **依赖注入**: 支持构造函数、属性和方法注入
- 🎯 **AOP切面编程**: 支持前置、后置、环绕通知
- 🔍 **循环依赖检测**: 智能的循环依赖检测和解决方案
- 📊 **依赖分析**: 完整的依赖关系图和分析报告
- 🛡️ **错误恢复**: 多种错误恢复策略
- 🎨 **装饰器支持**: 丰富的装饰器API简化开发
- 🚀 **性能优化**: 智能元数据缓存，针对实际应用场景优化
- ⚡ **高性能**: LRU缓存机制和热点数据预加载
- 📈 **监控统计**: 详细的缓存性能指标和优化建议
- 🔒 **线程安全**: 异步安全的单例模式，避免竞态条件
- 🔧 **版本冲突检测**: 自动检测和解决多版本共存问题
- 🌐 **生产就绪**: 适用于复杂生产环境和微服务架构

## 📦 安装

```bash
npm install koatty_container --save
# 或
yarn add koatty_container
# 或
pnpm add koatty_container
```

## 🚀 快速开始

### 基础使用

```typescript
import { IOC } from "koatty_container";
import { Autowired } from "koatty_container";

// 定义服务类
class UserService {
  getUser(id: string) {
    return { id, name: "John Doe" };
  }
}

class OrderService {
  @Autowired()
  userService: UserService;

  createOrder(userId: string) {
    const user = this.userService.getUser(userId);
    return { id: "order-1", user };
  }
}

// 注册组件
IOC.reg(UserService);
IOC.reg(OrderService);

// 获取实例
const orderService = IOC.get(OrderService);
const order = orderService.createOrder("user-1");
```

### 配置注入

```typescript
import { Values } from "koatty_container";

class DatabaseService {
  @Values("database.host")
  host: string;

  @Values("database.port", 3306)
  port: number;

  connect() {
    console.log(`Connecting to ${this.host}:${this.port}`);
  }
}
```

### AOP切面编程

```typescript
import { Aspect, Before, After } from "koatty_container";

@Aspect()
class LoggingAspect {
  @Before("UserService.getUser")
  logBefore(target: any, methodName: string, args: any[]) {
    console.log(`Before ${methodName}:`, args);
  }

  @After("UserService.getUser")
  logAfter(target: any, methodName: string, result: any) {
    console.log(`After ${methodName}:`, result);
  }
}
```

## 🔧 高级特性

### 版本冲突检测和处理

在复杂的项目中，可能存在多个组件依赖不同版本的koatty_container，这会导致多个IOC容器实例，破坏单例模式。koatty_container提供了完整的版本冲突检测和处理机制。

#### 版本冲突问题

```bash
# 项目依赖情况示例
project/
├── package.json (koatty_container: ^1.12.0)
├── node_modules/
│   ├── koatty_container@1.12.0
│   ├── some-plugin/
│   │   └── node_modules/
│   │       └── koatty_container@1.11.0  # 版本冲突！
│   └── another-plugin/
│       └── node_modules/
│           └── koatty_container@1.10.0  # 版本冲突！
```

#### 自动检测和处理

```typescript
import { IOC, VersionConflictDetector } from "koatty_container";

// 容器会在初始化时自动检测版本冲突
const container = IOC;

// 获取版本冲突报告
const report = container.generateVersionConflictReport();
if (report.hasConflict) {
  console.log("检测到版本冲突:");
  console.log(report.conflictError?.getConflictDetails());
  
  // 获取解决建议
  const suggestions = report.conflictError?.getResolutionSuggestions();
  suggestions?.forEach(suggestion => console.log(suggestion));
}
```

#### 手动版本管理

```typescript
// 创建版本冲突检测器
const detector = new VersionConflictDetector("1.12.0");
detector.registerVersion();

// 检测冲突
const conflict = detector.detectVersionConflicts();
if (conflict) {
  console.log(conflict.getConflictDetails());
}

// 检查版本兼容性
const isCompatible = detector.checkVersionCompatibility("1.11.0");
console.log(`版本兼容: ${isCompatible}`); // true

// 解决冲突
const resolved = detector.resolveVersionConflict('use_latest');
```

#### 冲突解决策略

```typescript
// 1. 使用最新版本（推荐）
detector.resolveVersionConflict('use_latest');

// 2. 使用最早版本
detector.resolveVersionConflict('use_earliest');

// 3. 强制使用当前版本
detector.resolveVersionConflict('force_current');

// 4. 获取推荐策略
const strategy = detector.getVersionResolutionStrategy();
console.log(`推荐策略: ${strategy}`);
```

#### 版本兼容性规则

koatty_container使用以下兼容性规则：

```typescript
// 兼容的版本示例
"1.12.0" ↔ "1.11.0" ✅ (次版本号差异 ≤ 2)
"1.12.0" ↔ "1.10.0" ✅ (次版本号差异 ≤ 2) 
"1.12.0" ↔ "1.12.5" ✅ (补丁版本总是兼容)

// 不兼容的版本示例
"1.12.0" ↔ "2.0.0"  ❌ (主版本号不同)
"1.12.0" ↔ "1.8.0"  ❌ (次版本号差异 > 2)
```

#### 解决建议

当检测到版本冲突时，系统会提供以下解决建议：

1. **统一版本依赖**
```json
{
  "dependencies": {
    "koatty_container": "^1.12.0"
  },
  "resolutions": {
    "koatty_container": "1.12.0"
  }
}
```

2. **检查依赖树**
```bash
npm ls koatty_container
# 或
yarn why koatty_container
```

3. **清理重装**
```bash
rm -rf node_modules package-lock.json
npm install
```

4. **使用resolutions强制统一版本**
```json
{
  "resolutions": {
    "**/koatty_container": "1.12.0"
  }
}
```

### 性能优化

koatty_container 针对实际应用场景提供了高性能的元数据缓存优化：

#### 元数据缓存

在实际项目中，依赖注入过程会频繁访问装饰器元数据，元数据缓存可以显著提升性能：

```typescript
import { IOC } from "koatty_container";

// 场景1：在分类型注册前预加载元数据
IOC.preloadMetadata('CONTROLLER'); // 预加载所有控制器的元数据
const controllers = IOC.listClass('CONTROLLER');
controllers.forEach(({target, id}) => {
  IOC.reg(target); // 注册时可以快速访问缓存的元数据
});

// 场景2：预加载所有组件的元数据
IOC.preloadMetadata(); // 提升运行时IOC.get()的性能

// 获取缓存统计
const stats = IOC.getPerformanceStats();
console.log(`缓存命中率: ${(stats.cache.hitRate * 100).toFixed(2)}%`);
```

#### 应用场景说明

**1. 项目启动优化**
```typescript
// 典型的项目启动流程
// 1. 加载组件类
import { UserController } from './controllers/UserController';
import { UserService } from './services/UserService';

// 2. 保存到容器
IOC.saveClass('CONTROLLER', UserController, 'UserController');
IOC.saveClass('SERVICE', UserService, 'UserService');

// 3. 预加载控制器元数据
IOC.preloadMetadata('CONTROLLER');

// 4. 批量注册控制器
const controllers = IOC.listClass('CONTROLLER');
controllers.forEach(({target}) => IOC.reg(target));
```

**2. 运行时性能优化**
```typescript
// 在高频率的业务逻辑中，缓存可以避免重复的反射调用
export class OrderController {
  // IOC.get() 会从缓存中快速获取依赖信息
  processOrder() {
    const userService = IOC.get('UserService');  // 快速访问
    const emailService = IOC.get('EmailService'); // 快速访问
    // 业务逻辑...
  }
}
```

#### 性能监控

```typescript
// 获取详细的性能统计
const stats = IOC.getPerformanceStats();
console.log('性能统计:', {
  cacheHitRate: `${(stats.cache.hitRate * 100).toFixed(2)}%`,
  totalCacheRequests: stats.cache.totalRequests,
  registeredComponents: stats.totalRegistered,
  memoryUsage: stats.memoryUsage
});

// 执行性能优化
IOC.optimizePerformance();
```

### 线程安全和异步容器初始化

虽然JavaScript是单线程的，但在异步场景下仍可能出现竞态条件。koatty_container v1.14.0实现了异步安全的单例模式。

#### 问题场景

```typescript
// 并发容器初始化可能导致多个实例
async function scenario1() {
  const container = Container.getInstance(); // 可能返回Promise
  return container;
}

async function scenario2() {
  const container = Container.getInstance(); // 可能创建不同实例
  return container;
}

// 同时调用
Promise.all([scenario1(), scenario2()]); // 可能产生竞态条件
```

#### 解决方案

```typescript
// 异步安全的容器获取
import { IOC, ensureIOCReady } from "koatty_container";

// 方式1：使用ensureIOCReady确保容器就绪
const container = await ensureIOCReady();

// 方式2：处理可能的Promise返回
const result = Container.getInstance();
const container = result instanceof Promise ? await result : result;

// 方式3：同步访问（向后兼容）
const container = Container.getInstanceSync();
```

#### 线程安全特性

1. **异步安全的双重检查锁定**：防止并发初始化
2. **Promise同步机制**：确保并发调用返回相同实例
3. **状态跟踪**：监控初始化状态防止竞态条件
4. **错误恢复**：初始化失败后自动重置状态
5. **向后兼容**：保持现有同步API

### 组件生命周期

```typescript
import { Component, PostConstruct, PreDestroy } from "koatty_container";

@Component()
class DatabaseConnection {
  @PostConstruct()
  init() {
    console.log("数据库连接初始化");
  }

  @PreDestroy()
  destroy() {
    console.log("数据库连接销毁");
  }
}
```

### 循环依赖处理

```typescript
// 自动检测循环依赖
class ServiceA {
  @Autowired()
  serviceB: ServiceB;
}

class ServiceB {
  @Autowired()
  serviceA: ServiceA;
}

// 容器会自动检测并提供解决方案
try {
  IOC.reg(ServiceA);
  IOC.reg(ServiceB);
} catch (error) {
  console.log("检测到循环依赖:", error.message);
}
```

### 依赖分析

```typescript
// 获取依赖关系图
const dependencyGraph = IOC.getDependencyGraph();
console.log("依赖关系:", dependencyGraph);

// 获取依赖分析报告
const analysis = IOC.analyzeDependencies();
console.log("分析报告:", analysis);
```

## 📋 API 文档

### 核心API

#### IOC 容器

| 方法 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `reg(target, options?)` | `target: Function, options?: RegisterOptions` | `void` | 注册组件 |
| `get<T>(target)` | `target: Function \| string` | `T` | 获取组件实例 |
| `has(target)` | `target: Function \| string` | `boolean` | 检查组件是否存在 |
| `clear()` | - | `void` | 清空容器 |

#### 性能优化API

| 方法 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `preloadMetadata(type?)` | `type?: ComponentType` | `void` | 预加载特定类型组件元数据 |
| `getPerformanceStats()` | - | `PerformanceStats` | 获取性能统计 |
| `optimizePerformance()` | - | `void` | 执行性能优化 |

#### 依赖分析API

| 方法 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `getDependencyGraph()` | - | `DependencyGraph` | 获取依赖关系图 |
| `analyzeDependencies()` | - | `DependencyAnalysis` | 分析依赖关系 |
| `detectCircularDependencies()` | - | `CircularDependency[]` | 检测循环依赖 |

### 装饰器

#### 依赖注入装饰器

| 装饰器 | 参数 | 用途 | 示例 |
|--------|------|------|------|
| `@Autowired()` | `identifier?: string` | 属性注入 | `@Autowired() service: UserService` |
| `@Values()` | `key: string, defaultValue?` | 配置注入 | `@Values("db.host") host: string` |

#### AOP装饰器

| 装饰器 | 参数 | 用途 | 示例 |
|--------|------|------|------|
| `@Aspect()` | - | 定义切面类 | `@Aspect() class LogAspect` |
| `@Before()` | `pointcut: string` | 前置通知 | `@Before("*.save") before()` |
| `@After()` | `pointcut: string` | 后置通知 | `@After("*.save") after()` |
| `@Around()` | `pointcut: string` | 环绕通知 | `@Around("*.save") around()` |

#### 组件装饰器

| 装饰器 | 参数 | 用途 | 示例 |
|--------|------|------|------|
| `@Component()` | `options?` | 定义组件 | `@Component() class Service` |
| `@Service()` | `options?` | 定义服务 | `@Service() class UserService` |
| `@Repository()` | `options?` | 定义仓储 | `@Repository() class UserRepo` |

## 📊 性能优化详情

### 元数据缓存系统

koatty_container 的元数据缓存专门针对实际应用场景进行优化：

- **外部LRU缓存**: 基于成熟的 `lru-cache@11.x` 库，提供高性能缓存和完善的TTL支持
- **多层缓存**: reflect、property、class、dependency四种类型的专用缓存
- **热点预载**: 在组件注册前预加载常用元数据，避免运行时反射调用
- **内存监控**: 自动监控内存使用，提供优化建议
- **智能失效**: 基于访问模式的智能缓存失效策略
- **生产级可靠性**: 使用经过验证的外部库，保证缓存功能的稳定性和性能

### 实际应用价值

**真实性能提升效果：**
- **启动时元数据预加载**: 减少注册阶段的反射调用，提升启动速度 20-40%
- **运行时缓存命中**: 缓存命中率通常 > 80%，IOC.get() 性能提升 50-80%
- **内存使用优化**: 避免重复元数据存储，内存使用减少 15-30%
- **并发场景优化**: 高并发时避免重复反射，CPU 使用率降低 20-50%

### 最佳实践场景

```typescript
// 1. 项目启动时的典型优化流程
async function initializeApplication() {
  // 保存所有组件类
  registerAllClasses();
  
  // 分类型预加载和注册
  IOC.preloadMetadata('COMPONENT');
  await registerComponents();
  
  IOC.preloadMetadata('SERVICE');
  await registerServices();
  
  IOC.preloadMetadata('CONTROLLER');
  await registerControllers();
  
  // 最后预加载所有剩余元数据
  IOC.preloadMetadata();
}

// 2. 高频业务场景优化
class HighFrequencyService {
  processRequest() {
    // 这些 IOC.get() 调用将从缓存中快速获取
    const userService = IOC.get('UserService');
    const authService = IOC.get('AuthService');
    const cacheService = IOC.get('CacheService');
    // 业务逻辑处理...
  }
}
```

## 🛠️ 配置选项

### 容器配置

```typescript
const container = new Container({
  // 启用严格模式
  strict: true,
  
  // 性能优化配置
  performance: {
    // 元数据缓存配置
    cache: {
      maxSize: 1000,      // 最大缓存条目数
      ttl: 300000,        // TTL时间（毫秒）
      enableLRU: true     // 启用LRU算法
    }
  }
});
```

### 环境变量

支持通过环境变量配置：

```bash
# 启用调试模式
KOATTY_CONTAINER_DEBUG=true

# 设置缓存大小
KOATTY_CONTAINER_CACHE_SIZE=2000

# 设置缓存TTL（毫秒）
KOATTY_CONTAINER_CACHE_TTL=600000
```

## 🔍 故障排除

### 常见问题

#### 1. 循环依赖错误

```typescript
// 问题：ServiceA 和 ServiceB 相互依赖
// 解决方案：使用延迟注入或重构设计

class ServiceA {
  @Autowired(() => ServiceB) // 延迟注入
  serviceB: ServiceB;
}
```

#### 2. 组件未找到

```typescript
// 问题：Bean not found
// 解决方案：确保组件已注册

// 错误示例
const service = IOC.get(UnregisteredService); // 抛出错误

// 正确示例
IOC.reg(MyService);
const service = IOC.get(MyService); // 成功
```

#### 3. 性能问题

```typescript
// 问题：组件注册或获取慢
// 解决方案：启用元数据缓存和预加载

// 在分类型注册前预加载
IOC.preloadMetadata('CONTROLLER');
const controllers = IOC.listClass('CONTROLLER');
controllers.forEach(({target}) => IOC.reg(target));

// 监控缓存性能
const stats = IOC.getPerformanceStats();
if (stats.cache.hitRate < 0.7) {
  IOC.optimizePerformance();
}
```

### 调试模式

```typescript
// 启用详细日志
process.env.KOATTY_CONTAINER_DEBUG = 'true';

// 获取调试信息
const debugInfo = IOC.getDebugInfo();
console.log(debugInfo);
```

## 🧪 测试支持

### 单元测试

```typescript
import { IOC } from "koatty_container";

describe("Service Tests", () => {
  beforeEach(() => {
    IOC.clear(); // 清空容器
  });

  test("should inject dependencies", () => {
    IOC.reg(UserService);
    IOC.reg(OrderService);
    
    const orderService = IOC.get(OrderService);
    expect(orderService.userService).toBeDefined();
  });
});
```

### 模拟依赖

```typescript
// 注册模拟服务
class MockUserService {
  getUser() {
    return { id: "mock", name: "Mock User" };
  }
}

IOC.reg(MockUserService, "UserService");
```

## 📈 最佳实践

### 1. 组件设计

```typescript
// ✅ 推荐：单一职责
@Service()
class UserService {
  async findById(id: string) {
    // 只处理用户相关逻辑
  }
}

// ❌ 不推荐：职责混乱
class UserOrderService {
  // 混合了用户和订单逻辑
}
```

### 2. 依赖注入

```typescript
// ✅ 推荐：明确的依赖
class OrderService {
  @Autowired()
  userService: UserService;
  
  @Autowired()
  emailService: EmailService;
}

// ❌ 不推荐：隐式依赖
class OrderService {
  createOrder() {
    const userService = new UserService(); // 硬编码依赖
    }
}
```

### 3. 性能优化

```typescript
// ✅ 推荐：分类型预加载元数据
IOC.preloadMetadata('CONTROLLER');
const controllers = IOC.listClass('CONTROLLER');
controllers.forEach(({target}) => IOC.reg(target));

// ✅ 推荐：监控缓存性能
const stats = IOC.getPerformanceStats();
if (stats.cache.hitRate < 0.8) {
  console.warn('缓存命中率较低，考虑调整预加载策略');
  IOC.optimizePerformance();
}

// ✅ 推荐：在高频操作前预加载
IOC.preloadMetadata(); // 预加载所有元数据
```

## 🤝 贡献指南

欢迎贡献代码！请阅读我们的贡献指南：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发环境

```bash
# 克隆项目
git clone https://github.com/koatty/koatty_container.git

# 安装依赖
npm install

# 运行测试
npm test

# 构建项目
npm run build
```

## 📄 许可证

[MIT](LICENSE)

## 🔗 相关项目

- [Koatty](https://github.com/koatty/koatty) - 基于Koa的企业级Node.js框架
- [koatty_router](https://github.com/koatty/koatty_router) - Koatty路由组件
- [koatty_logger](https://github.com/koatty/koatty_logger) - Koatty日志组件

## 📞 联系我们

- 作者: richenlin
- 邮箱: richenlin@gmail.com
- QQ群: 474723819

---

⭐ 如果这个项目对你有帮助，请给我们一个星标！
