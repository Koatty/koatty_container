/*
 * @Description: Method decorator manager for preprocessing and performance optimization
 * @Usage: 
 * @Author: richen
 * @Date: 2024-01-17 16:00:00
 * @LastEditTime: 2024-01-17 16:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { DefaultLogger as logger } from "koatty_logger";
import { IOCContainer } from "../container/Container";


/**
 * Simple wrapper function type
 */
export type WrapperFunction = (
  originalMethod: Function,
  config: any,
  methodName: string,
  target: unknown
) => Function;

/**
 * Decorator metadata interface
 */
export interface DecoratorMetadata {
  type: string;
  config: object;
  applied: boolean;
  priority: number;
}

/**
 * Method wrapper information
 */
interface MethodWrapper {
  originalMethod: Function;
  wrappedMethod: Function;
  decorators: Map<string, DecoratorMetadata>;
  isWrapped: boolean;
}

/**
 * Decorator manager for preprocessing and performance optimization
 * Integrated with koatty IOC container
 */
export class MethodDecoratorManager {
  // Use WeakMap to avoid memory leaks and keep metadata private
  private methodRegistry = new WeakMap<Function, MethodWrapper>();

  // Cache for compiled wrapper functions
  private wrapperCache = new Map<string, Function>();

  // Registry of wrapper functions by decorator type
  private wrapperRegistry = new Map<string, WrapperFunction>();

  // Symbols for marking decorated methods
  private static readonly DECORATED_SYMBOL = Symbol('koatty_method_decorated');
  private static readonly METADATA_SYMBOL = Symbol('koatty_method_metadata');

  constructor() {
    // Register this instance in IOC container
    this.registerInContainer();
  }

  /**
   * Register a wrapper function for a decorator type
   * @param decoratorType - The decorator type (string)
   * @param wrapperFunction - The wrapper function
   */
  public registerWrapper(decoratorType: string, wrapperFunction: WrapperFunction): void {
    this.wrapperRegistry.set(decoratorType, wrapperFunction);
    logger.Debug(`Registered wrapper for decorator type: ${decoratorType}`);
  }

  /**
   * Unregister a wrapper function
   * @param decoratorType - The decorator type to unregister
   */
  public unregisterWrapper(decoratorType: string): boolean {
    const removed = this.wrapperRegistry.delete(decoratorType);
    if (removed) {
      logger.Debug(`Unregistered wrapper for decorator type: ${decoratorType}`);
    }
    return removed;
  }

  /**
   * Get all registered wrapper types
   */
  public getRegisteredTypes(): string[] {
    return Array.from(this.wrapperRegistry.keys());
  }

  /**
   * Check if a wrapper is registered for the given type
   */
  public hasWrapper(decoratorType: string): boolean {
    return this.wrapperRegistry.has(decoratorType);
  }

  /**
   * Register MethodDecoratorManager in IOC container
   * @private
   */
  private registerInContainer(): void {
    try {
      // Register as a singleton component in IOC container
      IOCContainer.reg('MethodDecoratorManager', MethodDecoratorManager, {
        type: 'COMPONENT',
        args: []
      });
      logger.Debug('MethodDecoratorManager registered in IOC container');
    } catch (_error) {
      logger.Debug('IOC container not available, continuing without registration', _error);
    }
  }

  /**
   * Get MethodDecoratorManager instance from IOC container
   * @static
   * @returns MethodDecoratorManager instance
   */
  public static getInstance(): MethodDecoratorManager {
    try {
      // Try to get from IOC container first
      let instance = IOCContainer.get('MethodDecoratorManager', 'COMPONENT') as MethodDecoratorManager;
      if (!instance) {
        // Create new instance if not found in container
        instance = new MethodDecoratorManager();
      }
      return instance;
    } catch (_error) {
      logger.Debug('Creating new MethodDecoratorManager instance outside IOC container', _error);
      return new MethodDecoratorManager();
    }
  }

  /**
   * Register a decorator for a method
   * @param target - Target object
   * @param propertyKey - Method name
   * @param decorator - Decorator metadata
   * @param originalDescriptor - Original property descriptor
   * @returns Enhanced property descriptor
   */
  registerDecorator(
    target: unknown,
    propertyKey: string,
    decorator: DecoratorMetadata,
    originalDescriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = originalDescriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(`Cannot decorate non-function property: ${propertyKey}`);
    }

    // Check if method is already wrapped
    let wrapper = this.methodRegistry.get(originalMethod);
    if (!wrapper) {
      wrapper = {
        originalMethod,
        wrappedMethod: originalMethod,
        decorators: new Map(),
        isWrapped: false
      };
      this.methodRegistry.set(originalMethod, wrapper);
    }

    // Check if this decorator type is already applied
    if (wrapper.decorators.has(decorator.type)) {
      logger.Warn(`Decorator ${decorator.type} is already applied to ${propertyKey}, skipping duplicate`);
      return { ...originalDescriptor, value: wrapper.wrappedMethod };
    }

    // Register the decorator
    wrapper.decorators.set(decorator.type, decorator);

    // Create or update the wrapped method
    const wrappedMethod = this.createOptimizedWrapper(wrapper, target, propertyKey);
    wrapper.wrappedMethod = wrappedMethod;
    wrapper.isWrapped = true;

    // Mark the original method as decorated
    this.markAsDecorated(originalMethod, wrapper.decorators);

    return {
      ...originalDescriptor,
      value: wrappedMethod
    };
  }

  /**
   * Create an optimized wrapper function that combines all decorators
   * @param wrapper - Method wrapper information
   * @param target - Target object
   * @param propertyKey - Method name
   * @returns Optimized wrapper function
   */
  private createOptimizedWrapper(wrapper: MethodWrapper, target: unknown, propertyKey: string): Function {
    const decorators = Array.from(wrapper.decorators.values());

    // Sort decorators by priority (higher priority executes first)
    decorators.sort((a, b) => b.priority - a.priority);

    // Generate cache key for this combination of decorators
    const cacheKey = this.generateCacheKey(decorators, propertyKey);

    // Check if we have a cached wrapper for this combination
    const cachedWrapper = this.wrapperCache.get(cacheKey);
    if (cachedWrapper) {
      logger.Debug(`Using cached wrapper for ${propertyKey}`);
      return cachedWrapper.bind(target);
    }

    // Create new optimized wrapper
    const optimizedWrapper = this.compileWrapper(wrapper.originalMethod, decorators, propertyKey, target);

    // Cache the wrapper for future use
    this.wrapperCache.set(cacheKey, optimizedWrapper);

    logger.Debug(`Created optimized wrapper for ${propertyKey} with decorators: ${decorators.map(d => d.type).join(', ')}`);

    return optimizedWrapper;
  }

  /**
   * Compile a single wrapper function that handles all decorators efficiently
   * @param originalMethod - Original method
   * @param decorators - Applied decorators
   * @param methodName - Method name for debugging
   * @param target - Target object
   * @returns Compiled wrapper function
   */
  private compileWrapper(originalMethod: Function, decorators: DecoratorMetadata[], methodName: string, target: unknown): Function {
    if (decorators.length === 0) {
      return originalMethod;
    }

    // Apply wrappers in chain, starting with the original method
    let wrappedMethod = originalMethod;

    // Apply decorators in reverse order so higher priority decorators wrap the others
    for (const decorator of decorators.reverse()) {
      const decoratorType = decorator.type.toString();
      const wrapperFunction = this.wrapperRegistry.get(decoratorType);

      if (!wrapperFunction) {
        logger.Warn(`No wrapper function registered for decorator type: ${decoratorType}`);
        continue;
      }

      try {
        wrappedMethod = wrapperFunction(wrappedMethod, decorator.config, methodName, target);
        logger.Debug(`Applied wrapper for ${decoratorType} to method ${methodName}`);
      } catch (error) {
        logger.Error(`Failed to apply wrapper for ${decoratorType} to method ${methodName}:`, error);
        // Continue with the current wrapped method, don't fail the entire chain
      }
    }

    return wrappedMethod;
  }

  /**
   * Generate cache key for decorator combination
   * @param decorators - Applied decorators
   * @param methodName - Method name
   * @returns Cache key
   */
  private generateCacheKey(decorators: DecoratorMetadata[], methodName: string): string {
    const decoratorKeys = decorators
      .map(d => `${d.type}:${JSON.stringify(d.config)}`)
      .sort()
      .join('|');

    return `${methodName}:${decoratorKeys}`;
  }

  /**
   * Mark a method as decorated to prevent duplicate processing
   * @param method - Method to mark
   * @param decorators - Applied decorators
   */
  private markAsDecorated(method: Function, decorators: Map<string, DecoratorMetadata>): void {
    // Check if already marked, if not, mark it
    if (!Object.prototype.hasOwnProperty.call(method, MethodDecoratorManager.DECORATED_SYMBOL)) {
      Object.defineProperty(method, MethodDecoratorManager.DECORATED_SYMBOL, {
        value: true,
        writable: false,
        enumerable: false,
        configurable: true // Allow updates for multiple decorators
      });
    }

    // Always update metadata as new decorators are added
    Object.defineProperty(method, MethodDecoratorManager.METADATA_SYMBOL, {
      value: decorators,
      writable: false,
      enumerable: false,
      configurable: true // Allow updates for multiple decorators
    });
  }

  /**
   * Check if a method is already decorated
   * @param method - Method to check
   * @returns true if decorated, false otherwise
   */
  isDecorated(method: Function): boolean {
    return !!(method as any)[MethodDecoratorManager.DECORATED_SYMBOL];
  }

  /**
   * Get decorator metadata for a method
   * @param method - Method to check
   * @returns Decorator metadata map
   */
  getDecoratorMetadata(method: Function): Map<string, DecoratorMetadata> | null {
    return (method as any)[MethodDecoratorManager.METADATA_SYMBOL] || null;
  }

  /**
   * Clear all cached wrappers (useful for testing or hot reloading)
   */
  clearCache(): void {
    this.wrapperCache.clear();
    logger.Debug('Decorator wrapper cache cleared');
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.wrapperCache.size,
      keys: Array.from(this.wrapperCache.keys())
    };
  }
} 