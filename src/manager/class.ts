/*
 * @Description: Class decorator manager for preprocessing and performance optimization
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
 * Simple class wrapper function type
 */
export type ClassWrapperFunction = (
  originalClass: Function,
  config: any,
  className: string
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
 * Class wrapper information
 */
interface ClassWrapper {
  originalClass: Function;
  wrappedClass: Function;
  decorators: Map<string, DecoratorMetadata>;
  isWrapped: boolean;
  instances: WeakSet<any>; // Track instances for cleanup
}

/**
 * Class decorator manager for preprocessing and performance optimization
 * Integrated with koatty IOC container
 */
export class ClassDecoratorManager {
  // Use WeakMap to avoid memory leaks and keep metadata private
  private classRegistry = new WeakMap<Function, ClassWrapper>();

  // Cache for compiled wrapper classes
  private wrapperCache = new Map<string, Function>();

  // Registry of wrapper functions by decorator type
  private wrapperRegistry = new Map<string, ClassWrapperFunction>();

  // Symbols for marking decorated classes
  private static readonly DECORATED_SYMBOL = Symbol('koatty_class_decorated');
  private static readonly METADATA_SYMBOL = Symbol('koatty_class_metadata');

  constructor() {
    // Register this instance in IOC container
    this.registerInContainer();
  }

  /**
   * Register a wrapper function for a decorator type
   * @param decoratorType - The decorator type (string)
   * @param wrapperFunction - The wrapper function
   */
  public registerWrapper(decoratorType: string, wrapperFunction: ClassWrapperFunction): void {
    this.wrapperRegistry.set(decoratorType, wrapperFunction);
    logger.Debug(`Registered class wrapper for decorator type: ${decoratorType}`);
  }

  /**
   * Unregister a wrapper function
   * @param decoratorType - The decorator type to unregister
   */
  public unregisterWrapper(decoratorType: string): boolean {
    const removed = this.wrapperRegistry.delete(decoratorType);
    if (removed) {
      logger.Debug(`Unregistered class wrapper for decorator type: ${decoratorType}`);
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
   * Register ClassDecoratorManager in IOC container
   * @private
   */
  private registerInContainer(): void {
    try {
      // Register as a singleton component in IOC container
      IOCContainer.reg('ClassDecoratorManager', ClassDecoratorManager, {
        type: 'COMPONENT',
        args: []
      });
      logger.Debug('ClassDecoratorManager registered in IOC container');
    } catch (_error) {
      logger.Debug('IOC container not available, continuing without registration', _error);
    }
  }

  /**
   * Get ClassDecoratorManager instance from IOC container
   * @static
   * @returns ClassDecoratorManager instance
   */
  public static getInstance(): ClassDecoratorManager {
    try {
      // Try to get from IOC container first
      let instance = IOCContainer.get('ClassDecoratorManager', 'COMPONENT') as ClassDecoratorManager;
      if (!instance) {
        // Create new instance if not found in container
        instance = new ClassDecoratorManager();
      }
      return instance;
    } catch (_error) {
      logger.Debug('Creating new ClassDecoratorManager instance outside IOC container', _error);
      return new ClassDecoratorManager();
    }
  }

  /**
   * Register a decorator for a class
   * @param target - Target class constructor
   * @param decorator - Decorator metadata
   * @returns Enhanced class constructor
   */
  registerDecorator(
    target: Function,
    decorator: DecoratorMetadata
  ): Function {
    if (typeof target !== 'function') {
      throw new Error(`Cannot decorate non-constructor: ${target}`);
    }

    // Check if class is already wrapped
    let wrapper = this.classRegistry.get(target);
    if (!wrapper) {
      wrapper = {
        originalClass: target,
        wrappedClass: target,
        decorators: new Map(),
        isWrapped: false,
        instances: new WeakSet()
      };
      this.classRegistry.set(target, wrapper);
    }

    // Check if this decorator type is already applied
    if (wrapper.decorators.has(decorator.type)) {
      logger.Warn(`Decorator ${decorator.type} is already applied to class ${target.name}, skipping duplicate`);
      return wrapper.wrappedClass;
    }

    // Register the decorator
    wrapper.decorators.set(decorator.type, decorator);

    // Create or update the wrapped class
    const wrappedClass = this.createOptimizedWrapper(wrapper, target.name);
    wrapper.wrappedClass = wrappedClass;
    wrapper.isWrapped = true;

    // Mark the original class as decorated
    this.markAsDecorated(target, wrapper.decorators);

    return wrappedClass;
  }

  /**
   * Create an optimized wrapper class that combines all decorators
   * @param wrapper - Class wrapper information
   * @param className - Class name for debugging
   * @returns Optimized wrapper class
   */
  private createOptimizedWrapper(wrapper: ClassWrapper, className: string): Function {
    const decorators = Array.from(wrapper.decorators.values());

    // Sort decorators by priority (higher priority executes first)
    decorators.sort((a, b) => b.priority - a.priority);

    // Generate cache key for this combination of decorators
    const cacheKey = this.generateCacheKey(decorators, className);

    // Check if we have a cached wrapper for this combination
    const cachedWrapper = this.wrapperCache.get(cacheKey);
    if (cachedWrapper) {
      logger.Debug(`Using cached class wrapper for ${className}`);
      return cachedWrapper;
    }

    // Create new optimized wrapper
    const optimizedWrapper = this.compileWrapper(wrapper.originalClass, decorators, className);

    // Cache the wrapper for future use
    this.wrapperCache.set(cacheKey, optimizedWrapper);

    logger.Debug(`Created optimized class wrapper for ${className} with decorators: ${decorators.map(d => d.type).join(', ')}`);

    return optimizedWrapper;
  }

  /**
   * Compile a single wrapper class that handles all decorators efficiently
   * @param originalClass - Original class constructor
   * @param decorators - Applied decorators
   * @param className - Class name for debugging
   * @returns Compiled wrapper class
   */
  private compileWrapper(originalClass: Function, decorators: DecoratorMetadata[], className: string): Function {
    if (decorators.length === 0) {
      return originalClass;
    }

    // Apply wrappers in chain, starting with the original class
    let wrappedClass = originalClass;

    // Apply decorators in reverse order so higher priority decorators wrap the others
    for (const decorator of decorators.reverse()) {
      const decoratorType = decorator.type.toString();
      const wrapperFunction = this.wrapperRegistry.get(decoratorType);

      if (!wrapperFunction) {
        logger.Warn(`No wrapper function registered for class decorator type: ${decoratorType}`);
        continue;
      }

      try {
        wrappedClass = wrapperFunction(wrappedClass, decorator.config, className);
        logger.Debug(`Applied class wrapper for ${decoratorType} to class ${className}`);
      } catch (error) {
        logger.Error(`Failed to apply class wrapper for ${decoratorType} to class ${className}:`, error);
        // Continue with the current wrapped class, don't fail the entire chain
      }
    }

    return wrappedClass;
  }

  /**
   * Generate cache key for decorator combination
   * @param decorators - Applied decorators
   * @param className - Class name
   * @returns Cache key
   */
  private generateCacheKey(decorators: DecoratorMetadata[], className: string): string {
    const decoratorKeys = decorators
      .map(d => `${d.type}:${JSON.stringify(d.config)}`)
      .sort()
      .join('|');

    return `${className}:${decoratorKeys}`;
  }

  /**
   * Mark a class as decorated to prevent duplicate processing
   * @param target - Class to mark
   * @param decorators - Applied decorators
   */
  private markAsDecorated(target: Function, decorators: Map<string, DecoratorMetadata>): void {
    // Check if already marked, if not, mark it
    if (!Object.prototype.hasOwnProperty.call(target, ClassDecoratorManager.DECORATED_SYMBOL)) {
      Object.defineProperty(target, ClassDecoratorManager.DECORATED_SYMBOL, {
        value: true,
        writable: false,
        enumerable: false,
        configurable: true // Allow updates for multiple decorators
      });
    }

    // Always update metadata as new decorators are added
    Object.defineProperty(target, ClassDecoratorManager.METADATA_SYMBOL, {
      value: decorators,
      writable: false,
      enumerable: false,
      configurable: true // Allow updates for multiple decorators
    });
  }

  /**
   * Check if a class is already decorated
   * @param target - Class to check
   * @returns true if decorated, false otherwise
   */
  isDecorated(target: Function): boolean {
    return !!(target as any)[ClassDecoratorManager.DECORATED_SYMBOL];
  }

  /**
   * Get decorator metadata for a class
   * @param target - Class to check
   * @returns Decorator metadata map
   */
  getDecoratorMetadata(target: Function): Map<string, DecoratorMetadata> | null {
    return (target as any)[ClassDecoratorManager.METADATA_SYMBOL] || null;
  }

  /**
   * Track instance creation for cleanup purposes
   * @param instance - Instance to track
   * @param constructor - Constructor used to create the instance
   */
  trackInstance(instance: any, constructor: Function): void {
    const wrapper = this.classRegistry.get(constructor);
    if (wrapper) {
      wrapper.instances.add(instance);
    }
  }

  /**
   * Clear all cached wrappers (useful for testing or hot reloading)
   */
  clearCache(): void {
    this.wrapperCache.clear();
    logger.Debug('Class decorator wrapper cache cleared');
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

  /**
   * Get all decorated classes
   * @returns Array of decorated class information
   */
  getDecoratedClasses(): Array<{ class: Function; decorators: string[]; isWrapped: boolean }> {
    const result: Array<{ class: Function; decorators: string[]; isWrapped: boolean }> = [];
    
    // Note: We can't iterate over WeakMap directly, but we can provide this info
    // when classes are registered. This method serves as a placeholder for
    // potential future tracking needs.
    
    return result;
  }
} 