# koatty-container 重构实施计划 V2

> 基于评审报告遗留问题的分步实施方案。每个任务独立可测试，按顺序执行。

## 用户决策

| 决策点 | 选择 |
|--------|------|
| `getInsByClass` 无缓存实例时 | **A: 抛出 Error**（fail-fast，与前次决策一致） |
| IContainer 中 `any` 返回类型 | **A: 泛型默认值** `<T = any>(): T`（向后兼容，消费者可选传入具体类型收窄） |
| `noUncheckedIndexedAccess` | **已启用**（仅 1 处编译错误，已修复） |

## 执行顺序

```
T-34 → T-35 → T-36 → T-37 → T-38 → T-39 → T-40 → T-41 → T-42 → T-43 → T-44
```

---

## Phase A: P1 Bug 修复（无破坏性变更）

### T-34: 修复 Lazy Proxy 双重 resolve() 调用

**文件**: `src/utils/lazy_proxy.ts`

**问题**: `get` trap（第48行）和 `set` trap（第51行）每次属性访问调用 `resolve()` 两次。虽然第二次命中缓存，但仍是不必要的函数调用开销。

**修改**:

1. 第48行 `get` trap:
```typescript
// Before:
return Reflect.get(resolve(), prop, resolve());

// After:
const target = resolve();
return Reflect.get(target, prop, target);
```

2. 第51行 `set` trap:
```typescript
// Before:
return Reflect.set(resolve(), prop, value, resolve());

// After:
const target = resolve();
return Reflect.set(target, prop, value, target);
```

**验证**: 运行 `npm test`，特别是 `test/LazyProxy.test.ts`。所有现有测试通过即可（无需新增测试，行为不变）。

---

### T-35: 移除 get() 方法中的不可达死代码

**文件**: `src/container/container.ts`

**问题**: 第 780-789 行存在不可达分支。在第 732 行 `if (cycle)` 已处理循环依赖并 return，到达第 780 行的 `else` 分支时 `cycle` 必然是 falsy，因此第 781 行 `if (cycle)` 永远为 false。

**修改**:

将第 779-790 行简化：
```typescript
// Before:
} else {
  if (cycle) {
    logger.Debug(`${className} not found and circular dependency detected...`);
    return createLazyProxy(...);
  } else {
    throw new Error(`Bean ${className} not found`);
  }
}

// After:
} else {
  throw new Error(`Bean ${className} not found`);
}
```

**验证**: 运行 `npm test`。所有现有测试通过。

---

### T-36: 修复 getInsByClass 残留类型谎言

**文件**: `src/container/lifecycle_manager.ts`

**问题**: 第 46-51 行，当 class 有效但 WeakMap 中无缓存实例且无 args 时，`instanceMap.get(target)` 返回 `undefined`，但方法签名声明返回 `T`。

**修改**:

```typescript
// Before (lifecycle_manager.ts:42-51):
public getInsByClass<T extends object | Function>(target: T, args: any[] = []): T {
  if (!helper.isClass(target)) {
    throw new Error(`getInsByClass: target is not a class`);
  }
  const instance: any = this.instanceMap.get(target);
  if (args.length > 0) {
    return Reflect.construct(<Function><unknown>target, args);
  } else {
    return instance;  // ← 可能是 undefined
  }
}

// After:
public getInsByClass<T extends object | Function>(target: T, args: any[] = []): T {
  if (!helper.isClass(target)) {
    throw new Error(`getInsByClass: target is not a class`);
  }
  if (args.length > 0) {
    return Reflect.construct(<Function><unknown>target, args);
  }
  const instance = this.instanceMap.get(target);
  if (instance === undefined) {
    throw new Error(`getInsByClass: no instance found for ${(target as Function).name || 'unknown'}`);
  }
  return instance as T;
}
```

**验证**:
1. 运行 `npm test`，修复因行为变更失败的测试（原来返回 undefined 的场景现在抛异常）
2. 在 `test/Container.test.ts` 中添加测试:
   - `getInsByClass(已注册但未实例化的class)` 应抛出 Error
   - `getInsByClass(已注册且已实例化的class)` 应正常返回

---

## Phase B: Container 拆分（保持接口兼容）

> 目标：将 Container 从 1400 行缩减到 ~700 行，提取 4 个职责模块。

### T-37: 提取 DependencyAnalyzer

**新建文件**: `src/container/dependency_analyzer.ts`  
**修改文件**: `src/container/container.ts`

**目的**: 将依赖分析职责从 Container 中提取。

**迁移方法**（约 110 行）:
- `extractDependencies(target)` — container.ts:531-577
- `checkStrictLifetime(id, dependencies, type)` — container.ts:588-599
- `generateDependencyReport()` — container.ts:1025-1057
- `hasCircularDependencies()` — container.ts:1059-1065
- `getCircularDependencies()` — container.ts:1067-1073

**实现**:
```typescript
// src/container/dependency_analyzer.ts
export class DependencyAnalyzer {
  constructor(
    private circularDependencyDetector: CircularDepDetector,
    private getClassFn: (id: string, type: string) => Function | undefined,
    private listPropertyDataFn: (key: string | symbol, target: Function | object) => any,
    private listClassFn: (type: string) => { id: string; target: Function }[]
  ) {}

  extractDependencies(target: any): string[] { ... }
  checkStrictLifetime(id: string, dependencies: string[], type: string): void { ... }
  generateDependencyReport(): void { ... }
  hasCircularDependencies(): boolean { ... }
  getCircularDependencies(): string[][] { ... }
}
```

**Container 修改**:
1. `private dependencyAnalyzer: DependencyAnalyzer`
2. 构造函数初始化（传入回调函数访问 Container 能力）
3. 所有 5 个方法改为单行委托

**验证**: `npx tsc --noEmit` 零错误 + `npm test` 全通过。

---

### T-38: 提取 PerformanceManager

**新建文件**: `src/container/performance_manager.ts`  
**修改文件**: `src/container/container.ts`

**迁移方法**（约 250 行）:
- `getPerformanceStats()` — container.ts:363-386
- `getDetailedPerformanceStats()` — container.ts:1142-1215
- `calculateTotalCacheSize(lruCaches)` — container.ts:1220-1239
- `clearPerformanceCache()` — container.ts:1359-1377
- `getInstanceMapSize()` — container.ts:388-394（private）
- `getMetadataMapSize()` — container.ts:396-414（private）

**实现**:
```typescript
// src/container/performance_manager.ts
export class PerformanceManager {
  constructor(
    private metadataCache: MetadataCache,
    private classMap: Map<string, Function>,
    private circularDependencyDetector: CircularDepDetector,
    private listClassFn: (type: string) => { id: string; target: Function }[]
  ) {}

  getPerformanceStats(): { ... } { ... }
  getDetailedPerformanceStats(): { ... } { ... }
  clearPerformanceCache(): void { ... }
  // private helpers
  private calculateTotalCacheSize(lruCaches: any): string { ... }
  private getInstanceMapSize(): number { ... }
  private getMetadataMapSize(): number { ... }
}
```

**Container 修改**:
1. `private performanceManager: PerformanceManager`
2. 构造函数初始化
3. 对应方法改为单行委托

**验证**: `npx tsc --noEmit` 零错误 + `npm test` 全通过。

---

### T-39: 提取 PreloadManager

**新建文件**: `src/container/preload_manager.ts`  
**修改文件**: `src/container/container.ts`

**迁移方法**（约 200 行）:
- `preloadMetadata(types, options)` — container.ts:165-346
- `findTargetByName(name)` — container.ts:351-358（private）

**实现**:
```typescript
// src/container/preload_manager.ts
export class PreloadManager {
  constructor(
    private metadataCache: MetadataCache,
    private listClassFn: (type: string) => { id: string; target: Function }[],
    private getDetailedStatsFn: () => any
  ) {}

  preloadMetadata(types: string[], options: { ... }): void { ... }
  private findTargetByName(name: string): Function | undefined { ... }
}
```

**依赖**: T-38（`getDetailedStatsFn` 来自 PerformanceManager）

**Container 修改**:
1. `private preloadManager: PreloadManager`
2. 构造函数初始化
3. `preloadMetadata` 委托到 `this.preloadManager`

**验证**: `npx tsc --noEmit` 零错误 + `npm test` 全通过。

---

### T-40: 提取 BatchRegistrar

**新建文件**: `src/container/batch_registrar.ts`  
**修改文件**: `src/container/container.ts`

**迁移方法**（约 120 行）:
- `batchRegister(components, batchOptions)` — container.ts:1251-1298
- `topologicalSortComponents(components)` — container.ts:1303-1354（private）

**实现**:
```typescript
// src/container/batch_registrar.ts
export class BatchRegistrar {
  constructor(
    private regFn: (id: string, target: any, options?: ObjectDefinitionOptions) => void,
    private getIdentifierFn: (target: Function | object) => string,
    private getTypeFn: (target: Function | object) => any,
    private extractDependenciesFn: (target: any) => string[],
    private preloadMetadataFn: (types: string[], options: any) => void
  ) {}

  batchRegister(components: { ... }[], batchOptions?: { ... }): void { ... }
  private topologicalSortComponents(components: { ... }[]): typeof components { ... }
}
```

**依赖**: T-37（`extractDependenciesFn`）、T-39（`preloadMetadataFn`）

**Container 修改**:
1. `private batchRegistrar: BatchRegistrar`
2. 构造函数初始化
3. `batchRegister` 委托到 `this.batchRegistrar`

**验证**: `npx tsc --noEmit` 零错误 + `npm test` 全通过。确认 Container 行数降至 ~700 行。

---

## Phase C: 类型安全增强

### T-41: IContainer 元数据方法 `any` → 泛型默认值

**文件**: `src/container/icontainer.ts`, `src/container/container.ts`, `src/container/metadata_store.ts`

**修改 IContainer 接口** — 9 处 `any` 返回类型改为泛型默认值：

```typescript
// Before:
getMetadataMap(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol): any;
getType(target: Function | object): any;
getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object, propertyName?: string): any;
getPropertyData(decoratorNameKey: string | symbol, target: Function | object, propertyName: string | symbol): any;
listPropertyData(decoratorNameKey: string | symbol, target: Function | object): any;

// After:
getMetadataMap<T = any>(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol): T;
getType<T = string>(target: Function | object): T;
getClassMetadata<T = any>(type: string, decoratorNameKey: string | symbol, target: Function | object, propertyName?: string): T;
getPropertyData<T = any>(decoratorNameKey: string | symbol, target: Function | object, propertyName: string | symbol): T;
listPropertyData<T = Record<string, any>>(decoratorNameKey: string | symbol, target: Function | object): T;
```

**修改 IContainerDiagnostics 接口**:
```typescript
// Before:
getPerformanceStats(): { cache: any; ... };
getDetailedPerformanceStats(): any;

// After:
getPerformanceStats(): { cache: Record<string, unknown>; ... };
getDetailedPerformanceStats(): Record<string, unknown>;
```

**修改 Container 实现**: 对应方法添加泛型参数，实现体不变。

**修改 MetadataStore**: 对应方法签名添加泛型。

**向后兼容**: 所有泛型参数有 `= any` 默认值，现有调用无需任何修改。

**验证**: `npx tsc --noEmit` 零错误 + `npm test` 全通过。检查 monorepo 中其他包是否使用了被修改的方法签名（如有则确认不受影响）。

---

### T-42: ObjectDefinitionOptions 和 IAspect 中的 `any` 收窄

**文件**: `src/container/icontainer.ts`

**修改**:

```typescript
// Before:
export interface ObjectDefinitionOptions {
  // ...
  args?: any[];
}

export interface IAspect {
  app: Application;
  run: (args: any[], proceed?: Function, options?: any) => Promise<any>;
}

// After:
export interface ObjectDefinitionOptions {
  // ...
  args?: unknown[];
}

export interface IAspect {
  app: Application;
  run: (args: unknown[], proceed?: (...args: unknown[]) => Promise<unknown>, options?: Record<string, unknown>) => Promise<unknown>;
}
```

**注意**: `args?: unknown[]` 可能影响消费者代码。如果消费者传入 `any[]`，`unknown[]` 兼容接收。但如果消费者从 `options.args` 中读取并直接使用，需要类型断言。

**验证**:
1. `npx tsc --noEmit` 零错误
2. `npm test` 全通过
3. 检查 monorepo 中其他包对 `ObjectDefinitionOptions.args` 和 `IAspect.run` 的使用，必要时添加类型断言

---

### T-43: 启用 useUnknownInCatchVariables

**文件**: `packages/koatty-container/tsconfig.json`, 以及所有因此产生编译错误的源文件

**修改**:
1. 将 `"useUnknownInCatchVariables": false` 改为 `true`（或直接删除该行，因为 `strict: true` 已包含）
2. 运行 `npx tsc --noEmit` 查看编译错误
3. 修复所有 catch 块：
   ```typescript
   // Before:
   } catch (error) {
     logger.Debug("Failed:", error);
   }

   // After:
   } catch (error: unknown) {
     const msg = error instanceof Error ? error.message : String(error);
     logger.Debug("Failed:", msg);
   }
   ```

**预估影响**: container.ts 中约有 15+ 处 catch 块，aop_processor.ts 约 5 处，autowired_processor.ts 约 3 处。

**验证**: `npx tsc --noEmit` 零错误 + `npm test` 全通过。

---

### T-44: 最终验证与行数确认

**目的**: 确认所有任务完成后的项目健康度。

**执行**:
1. `npx tsc --noEmit` — 零错误
2. `npm test` — 全通过
3. `npm run build` — 构建成功
4. 统计 Container 行数（`wc -l container.ts`），确认 ≤ 750 行
5. 检查测试覆盖率不低于 83%
6. 更新 CHANGELOG.md 追加 v2.2.0 条目

**验证**: 所有指标达标。

---

## 预期效果

| 指标 | 当前 | 完成后 |
|------|------|--------|
| Container 行数 | 1400 | ~700 |
| `any` 返回类型（公开接口） | 9+ | 0（全部泛型化） |
| catch 变量类型 | `any`（隐式） | `unknown`（显式） |
| Lazy Proxy resolve() 调用 | 每次属性访问 2 次 | 每次 1 次 |
| get() 死代码分支 | 1 处 | 0 |
| getInsByClass 类型诚实 | 返回 `undefined as T` | 抛 Error |
| 新增模块 | 0 | 4（DependencyAnalyzer, PerformanceManager, PreloadManager, BatchRegistrar） |

## 文件变更总览

```
src/container/
├── container.ts              # ~700 行（从 1400 缩减）
├── icontainer.ts             # 泛型化接口
├── metadata_store.ts         # 已有
├── lifecycle_manager.ts      # 已有
├── dependency_analyzer.ts    # 新建 ~110 行
├── performance_manager.ts    # 新建 ~250 行
├── preload_manager.ts        # 新建 ~200 行
├── batch_registrar.ts        # 新建 ~120 行
└── app.ts                    # 不变
src/utils/
├── lazy_proxy.ts             # 修复 resolve() 双重调用
└── ...
```
