/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2026-03-05
 */
/**
 * Lazy Proxy for resolving circular dependencies.
 * Creates a proxy that defers dependency resolution until first property access.
 */

const LAZY_PROXY_SYMBOL = Symbol('koatty_lazy_proxy');
const LAZY_RESOLVED_SYMBOL = Symbol('koatty_lazy_resolved');

/**
 * Create a lazy proxy that defers resolution until first property access.
 * @param resolver - Function that resolves the actual dependency
 * @param identifier - Human-readable identifier for error messages
 * @returns A proxy that transparently forwards to the resolved instance
 */
export function createLazyProxy<T extends object>(
  resolver: () => T,
  identifier: string
): T {
  let resolved: T | null = null;
  let resolveError: Error | null = null;

  const resolve = (): T => {
    if (resolveError) throw resolveError;
    if (resolved) return resolved;
    try {
      const result = resolver();
      if (!result) {
        throw new Error(`Lazy dependency resolution failed for: ${identifier} (resolved to ${result})`);
      }
      resolved = result;
      return resolved;
    } catch (e) {
      resolveError = e instanceof Error ? e : new Error(String(e));
      throw resolveError;
    }
  };

  return new Proxy({} as T, {
    get(_, prop) {
      if (prop === LAZY_PROXY_SYMBOL) return true;
      if (prop === LAZY_RESOLVED_SYMBOL) return resolved !== null;
      const target = resolve();
      return Reflect.get(target, prop, target);
    },
    set(_, prop, value) {
      const target = resolve();
      return Reflect.set(target, prop, value, target);
    },
    has(_, prop) {
      if (prop === LAZY_PROXY_SYMBOL || prop === LAZY_RESOLVED_SYMBOL) return true;
      return Reflect.has(resolve(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_, prop) {
      return Object.getOwnPropertyDescriptor(resolve(), prop);
    },
    getPrototypeOf() {
      return Object.getPrototypeOf(resolve());
    }
  });
}

/**
 * Check if an object is a lazy proxy.
 */
export function isLazyProxy(obj: any): boolean {
  try {
    return obj?.[LAZY_PROXY_SYMBOL] === true;
  } catch {
    return false;
  }
}

/**
 * Check if a lazy proxy has been resolved.
 */
export function isLazyProxyResolved(obj: any): boolean {
  try {
    return obj?.[LAZY_RESOLVED_SYMBOL] === true;
  } catch {
    return false;
  }
}
