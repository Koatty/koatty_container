/** AOP uses one entry point and preserves synchronous results until a thenable appears. */
import { DefaultLogger as logger } from "koatty_logger";
import { IContainer, TAGGED_AOP, TAGGED_CLS } from "../container/icontainer";
import { debugLog } from "../utils/debug";
import { getMethodNames } from "../utils/operator";

export function getAOPMethodMetadata(target: any, methodName: string, container?: IContainer): any[] {

  const classAOPData = container?.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target) || [];

  const methodAOPData = container?.getClassMetadata(TAGGED_CLS, TAGGED_AOP, target, methodName) || [];

  debugLog(() => `Processing AOP metadata for ${target.name}.${methodName}:`);
  debugLog(() => `  Class AOP data: ${JSON.stringify(classAOPData)}`);
  debugLog(() => `  Method AOP data: ${JSON.stringify(methodAOPData)}`);

  // Use Map to store only the last decorator of each type for each cut point
  const methodLevelDecorators = new Map<string, any>();
  const classLevelDecorators = new Map<string, any>();

  // Process method-specific metadata first (higher priority)
  // methodAOPData is now an array, process each item
  for (const data of methodAOPData) {
    if (data.method === methodName) {
      // For method-level decorators, later decorators override earlier ones
      const currentData = {
        type: data.type,
        aopName: data.name,
        method: methodName, // target method name, let the aspect know which method is being intercepted
        options: data.options
      };

      const existingData = methodLevelDecorators.get(data.type);
      debugLog(() => `  Method-level ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      methodLevelDecorators.set(data.type, currentData);
      if (existingData) {
        debugLog(() => `    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        debugLog(() => `    -> Using ${data.name} (first occurrence)`);
      }
    }
  }

  // Process class-level metadata
  // classAOPData is now an array, process each item
  for (const data of classAOPData) {
    // For AroundEach, BeforeEach, AfterEach - apply to all methods
    if (['AroundEach', 'BeforeEach', 'AfterEach'].includes(data.type)) {
      // For class-level decorators, later decorators override earlier ones
      const currentData = {
        type: data.type,
        aopName: data.name,
        method: methodName, // target method name, let the aspect know which method is being intercepted
        options: data.options
      };

      const existingData = classLevelDecorators.get(data.type);
      debugLog(() => `  Class-level ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      classLevelDecorators.set(data.type, currentData);
      if (existingData) {
        debugLog(() => `    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        debugLog(() => `    -> Using ${data.name} (first occurrence)`);
      }
    }
    // For Around, Before, After - only apply to specific methods
    else if (['Around', 'Before', 'After'].includes(data.type) && data.method === methodName) {
      // For method-level decorators from class metadata, later decorators override earlier ones
      const currentData = {
        type: data.type,
        aopName: data.name,
        method: methodName, // target method name, let the aspect know which method is being intercepted
        options: data.options
      };

      const existingData = methodLevelDecorators.get(data.type);
      debugLog(() => `  Method-level from class ${data.type}: ${data.name} ${existingData ? `vs existing ${existingData.aopName}` : '(first)'}`);

      // For duplicate decorators, use the later one (last in array = later declared)
      methodLevelDecorators.set(data.type, currentData);
      if (existingData) {
        debugLog(() => `    -> Using ${data.name} (later declared decorator, overrides earlier)`);
      } else {
        debugLog(() => `    -> Using ${data.name} (first occurrence)`);
      }
    }
  }

  // Combine all decorators, method-level takes precedence over class-level
  const aopMetadata: any[] = [];

  // Add method-level decorators
  for (const decorator of methodLevelDecorators.values()) {
    aopMetadata.push(decorator);
  }

  // Add class-level decorators (only if method-level doesn't have the same type)
  for (const decorator of classLevelDecorators.values()) {
    if (!methodLevelDecorators.has(decorator.type)) {
      aopMetadata.push(decorator);
    }
  }

  debugLog(() => `  Final AOP metadata: ${JSON.stringify(aopMetadata)}`);

  // Cache the result


  return aopMetadata;
}


const ORIGINAL = Symbol.for('koatty.aop.original');
const then = (value: any, next: (value: any) => any): any =>
  value && typeof value.then === 'function' ? Promise.resolve(value).then(next) : next(value);

function policy(data: any, container?: IContainer): 'throw' | 'log' {
  return data?.options?.onError ?? (container?.getApp() as any)?.security?.aop?.onAspectError ?? 'throw';
}
function recover(action: () => any, failure: (error: any) => any): any {
  try {
    const value = action();
    return value && typeof value.then === 'function' ? Promise.resolve(value).catch(failure) : value;
  } catch (error) { return failure(error); }
}
function callAspect(data: any, self: any, args: any[], proceed: any, result: any, container?: IContainer): any {
  if (!container) throw new Error(`No container for aspect ${data.aopName}`);
  const aspect: any = container.get(data.aopName, 'COMPONENT');
  if (!aspect || typeof aspect.run !== 'function') throw new Error(`Aspect ${data.aopName} not found`);
  return aspect.run(args, proceed, { ...data.options, target: self, targetMethod: data.method, result });
}
function once(action: (...args: any[]) => any): (...args: any[]) => any {
  let called = false, failed = false, result: any;
  return (...args) => {
    if (!called) {
      called = true;
      try { result = action(...args); } catch (error) { failed = true; result = error; }
    }
    if (failed) throw result;
    return result;
  };
}

export function injectAOP(target: any, container?: IContainer, instance?: any): any {
  if (!target?.prototype) return target;
  const destination = instance ?? target.prototype;
  for (const methodName of getMethodNames(target)) {
    if (['constructor', '__before', '__after', 'init', 'destroy', 'destructor'].includes(methodName)) continue;
    const method = destination[methodName];
    if (typeof method !== 'function') continue;
    const original = method[ORIGINAL] ?? method;
    const metadata = getAOPMethodMetadata(target, methodName, container);
    const before = metadata.filter(d => d.type === 'Before' || (d.type === 'BeforeEach' && !destination.__before));
    const after = metadata.filter(d => d.type === 'After' || (d.type === 'AfterEach' && !destination.__after));
    const around = metadata.filter(d => d.type === 'Around' || d.type === 'AroundEach').slice(-1)[0];
    if (!metadata.length && !destination.__before && !destination.__after) continue;
    const wrapper = function(this: any, ...args: any[]): any {
      const proceed = once((...changed: any[]) => original.apply(this, changed.length ? changed : args));
      const onError = (data: any, fallback: () => any) => (error: any) => {
        if (policy(data, container) !== 'log') throw error;
        logger.Error(`Aspect ${data.aopName} failed`, error);
        return fallback();
      };
      let pending = this.__before ? this.__before() : undefined;
      for (const data of before) pending = then(pending, () => recover(
        () => callAspect(data, this, args, undefined, undefined, container), onError(data, () => undefined)));
      pending = then(pending, () => around ? recover(
        () => callAspect(around, this, args, proceed, undefined, container), onError(around, () => proceed())) : proceed());
      return then(pending, result => {
        let completed: any;
        for (const data of after) completed = then(completed, () => recover(
          () => callAspect(data, this, args, undefined, result, container), onError(data, () => undefined)));
        if (this.__after) completed = then(completed, () => this.__after());
        return then(completed, () => result);
      });
    };
    Object.defineProperty(wrapper, ORIGINAL, { value: original });
    Object.defineProperty(destination, methodName, { value: wrapper, configurable: true, writable: true });
  }
  return target;
}

// Compatibility diagnostics: instances are no longer cached by process-wide name.
export function clearAOPCache(): void { /* no shared mutable cache */ }
export function warmupAOPCache(targets: any[], container?: IContainer): void {
  for (const target of targets) for (const method of getMethodNames(target)) getAOPMethodMetadata(target, method, container);
}
export function optimizeAOPCache(): void { /* registration-time closures need no eviction */ }
export function getAOPCacheSize() { return { aspects: 0, methodNames: 0 }; }
export function getAOPCacheStats() {
  return { overallHitRate: 0, cacheSize: getAOPCacheSize(), hitRates: { aspects: 0, methodNames: 0, overall: 0 }, memoryUsage: 0 };
}
export function logAOPCachePerformance(): void { debugLog(() => 'AOP metadata is compiled per instance; aspect instances resolve from the current container'); }
