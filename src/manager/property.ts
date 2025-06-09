/*
 * @Description: Property decorator manager for preprocessing and performance optimization
 * @Usage: 
 * @Author: richen
 * @Date: 2024-01-17 16:00:00
 * @LastEditTime: 2024-01-17 16:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { DefaultLogger as logger } from "koatty_logger";
import { IOCContainer } from "../container/Container";
import { DecoratorMetadata } from "./type";

/**
 * Property wrapper function type compatible with tests
 */
export type PropertyWrapperFunction = (
  originalDescriptor: PropertyDescriptor | undefined,
  config: any,
  propertyName: string,
  target: any
) => PropertyDescriptor;

/**
 * Property decorator metadata interface
 */
export interface PropertyDecoratorMetadata {
  wrapperTypes?: string[];
  config?: any;
  priority?: number;
}

/**
 * Property key for registry (combination of target and property name)
 * Note: Currently using string-based keys instead of object keys for simplicity
 */
interface _PropertyKey {
  target: unknown;
  propertyName: string;
}

/**
 * Property wrapper information
 */
interface PropertyWrapper {
  target: any;
  propertyKey: string | symbol;
  propertyName: string;
  metadata: PropertyDecoratorMetadata;
  wrapper: PropertyDescriptor;
  originalDescriptor?: PropertyDescriptor;
  decorators: Map<string, DecoratorMetadata>;
  isWrapped: boolean;
}

/**
 * Property decorator manager for preprocessing and performance optimization
 * Integrated with koatty IOC container
 * 
 * Note: When a property has a field initializer (e.g., `name: string = '';`),
 * the field initializer takes precedence over decorator defaultValue.
 * This is expected TypeScript/JavaScript behavior. To use decorator defaultValue,
 * remove the field initializer or use constructor assignment.
 */
export class PropertyDecoratorManager {
  // Use Map to store property wrappers with custom key
  private propertyRegistry = new Map<string, PropertyWrapper>();

  // Cache for compiled wrapper descriptors
  private wrapperCache = new Map<string, PropertyDescriptor>();

  // Registry of wrapper functions by decorator type
  private wrapperRegistry = new Map<string, PropertyWrapperFunction>();

  // Internal storage for property values
  private propertyValues = new WeakMap<any, Map<string | symbol, any>>();

  // Symbols for marking decorated properties
  private static readonly DECORATED_SYMBOL = Symbol('koatty_property_decorated');
  private static readonly METADATA_SYMBOL = Symbol('koatty_property_metadata');

  // Singleton instance
  private static instance: PropertyDecoratorManager;

  // Logger instance
  private logger = logger;

  constructor() {
    // Register this instance in IOC container
    this.registerInContainer();
  }

  /**
   * Register a wrapper function for a decorator type
   * @param decoratorType - The decorator type (string)
   * @param wrapperFunction - The wrapper function
   */
  public registerWrapper(decoratorType: string, wrapperFunction: PropertyWrapperFunction): void {
    this.wrapperRegistry.set(decoratorType, wrapperFunction);
    logger.Debug(`Registered property wrapper for decorator type: ${decoratorType}`);
  }

  /**
   * Unregister a wrapper function
   * @param decoratorType - The decorator type to unregister
   */
  public unregisterWrapper(decoratorType: string): boolean {
    const removed = this.wrapperRegistry.delete(decoratorType);
    if (removed) {
      logger.Debug(`Unregistered property wrapper for decorator type: ${decoratorType}`);
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
   * Register PropertyDecoratorManager in IOC container
   * @private
   */
  private registerInContainer(): void {
    try {
      // Register as a singleton component in IOC container
      IOCContainer.reg('PropertyDecoratorManager', PropertyDecoratorManager, {
        type: 'COMPONENT',
        args: []
      });
      logger.Debug('PropertyDecoratorManager registered in IOC container');
    } catch (_error) {
      logger.Debug('IOC container not available, continuing without registration', _error);
    }
  }

  /**
   * Get PropertyDecoratorManager instance from IOC container
   * @static
   * @returns PropertyDecoratorManager instance
   */
  public static getInstance(): PropertyDecoratorManager {
    // Use singleton pattern to avoid IOC circular dependency issues
    if (!PropertyDecoratorManager.instance) {
      PropertyDecoratorManager.instance = new PropertyDecoratorManager();
    }
    return PropertyDecoratorManager.instance;
  }

  /**
   * Generate a unique key for property identification
   * @param target - Target object
   * @param propertyName - Property name
   * @returns Unique key string
   */
  private generatePropertyKey(target: unknown, propertyName: string): string {
    // Use constructor name and property name for identification
    const constructorName = target && (target as any).constructor ? (target as any).constructor.name : 'Unknown';
    return `${constructorName}#${propertyName}`;
  }

  /**
   * Register a decorator for a property
   * @param target - Target object
   * @param propertyKey - Property name
   * @param metadata - Decorator metadata (can be DecoratorMetadata or PropertyDecoratorMetadata)
   * @param originalDescriptor - Original property descriptor
   * @returns Enhanced property descriptor
   */
  registerDecorator(
    target: any,
    propertyKey: string | symbol,
    metadata: DecoratorMetadata | PropertyDecoratorMetadata,
    originalDescriptor?: PropertyDescriptor
  ): PropertyDescriptor {
    const key = this.generatePropertyKey(target, String(propertyKey));
    const propertyName = String(propertyKey);

    // 如果没有提供原始descriptor，尝试获取它
    if (!originalDescriptor) {
      originalDescriptor = Object.getOwnPropertyDescriptor(target, propertyKey) || undefined;
    }

    // 检查是否已经装饰过
    if (this.propertyRegistry.has(key)) {
      this.logger.warn(`Property ${propertyName} already decorated, skipping duplicate`);
      // 为fallback创建默认的PropertyDecoratorMetadata
      const fallbackMetadata: PropertyDecoratorMetadata = 'type' in metadata
        ? { wrapperTypes: [(metadata as DecoratorMetadata).type], config: metadata.config, priority: metadata.priority }
        : metadata as PropertyDecoratorMetadata;
      return originalDescriptor || this.createDefaultDescriptor(target, propertyKey, fallbackMetadata);
    }

    // 转换metadata到统一格式
    let propertyMetadata: PropertyDecoratorMetadata;
    const decorators = new Map<string, DecoratorMetadata>();

    if ('type' in metadata) {
      // 这是 DecoratorMetadata 格式
      const decoratorMetadata = metadata as DecoratorMetadata;
      propertyMetadata = {
        wrapperTypes: [decoratorMetadata.type],
        config: decoratorMetadata.config,
        priority: decoratorMetadata.priority
      };
      decorators.set(decoratorMetadata.type, decoratorMetadata);
    } else {
      // 这是 PropertyDecoratorMetadata 格式
      propertyMetadata = metadata as PropertyDecoratorMetadata;
      if (propertyMetadata.wrapperTypes) {
        for (const type of propertyMetadata.wrapperTypes) {
          decorators.set(type, {
            type,
            config: propertyMetadata.config || {},
            applied: true,
            priority: propertyMetadata.priority || 0
          });
        }
      }
    }

    try {
      // 创建包装器
      const wrapper: PropertyWrapper = {
        target,
        propertyKey,
        propertyName,
        metadata: propertyMetadata,
        wrapper: this.createOptimizedWrapper(target, propertyKey, propertyMetadata, originalDescriptor),
        originalDescriptor,
        decorators,
        isWrapped: true
      };

      this.propertyRegistry.set(key, wrapper);

      // 标记为已装饰
      this.markAsDecorated(target, propertyName, decorators);

      this.logger.Debug(`Registered property decorator for ${propertyName}`);
      return wrapper.wrapper;
    } catch (error) {
      this.logger.Error(`Failed to register property decorator for ${String(propertyKey)}:`, error);
      return originalDescriptor || this.createDefaultDescriptor(target, propertyKey, propertyMetadata);
    }
  }

  /**
   * Create an optimized property wrapper with getter/setter
   * @param target - Target object
   * @param propertyKey - Property name
   * @param metadata - Decorator metadata
   * @param originalDescriptor - Original property descriptor
   * @returns Enhanced property descriptor
   */
  private createOptimizedWrapper(
    target: any,
    propertyKey: string | symbol,
    metadata: PropertyDecoratorMetadata,
    originalDescriptor?: PropertyDescriptor
  ): PropertyDescriptor {
    // Apply wrapper functions in sequence to create the final descriptor
    let finalDescriptor = originalDescriptor;
    
    if (metadata.wrapperTypes) {
      for (const wrapperType of metadata.wrapperTypes) {
        const wrapperFunction = this.wrapperRegistry.get(wrapperType);
        if (wrapperFunction) {
          try {
            // Call wrapper function with the correct signature
            const result = wrapperFunction(
              finalDescriptor, 
              metadata.config || {}, 
              String(propertyKey), 
              target
            );
    
            finalDescriptor = result;
          } catch (error) {
            this.logger.Error(`Error applying wrapper ${wrapperType}:`, error);
            throw error;
          }
        } else {
          this.logger.warn(`No wrapper function registered for type: ${wrapperType}`);
        }
      }
    }
    
    // If no final descriptor was created, create a default one
    if (!finalDescriptor) {
      finalDescriptor = {
        get: function(this: any) {
          const privateKey = `_${String(propertyKey)}`;
          if (!(privateKey in this) && metadata.config?.defaultValue !== undefined) {
            (this as any)[privateKey] = metadata.config.defaultValue;
          }
          return (this as any)[privateKey];
        },
        set: function(this: any, value: any) {
          (this as any)[`_${String(propertyKey)}`] = value;
        },
        enumerable: true,
        configurable: true
      };
    }

    // 只在没有wrapper函数处理的情况下才进行字段初始化器检测
    // 如果wrapper函数已经返回了完整的descriptor，我们应该信任它
    if (metadata.wrapperTypes && metadata.wrapperTypes.length > 0) {
      // 有wrapper函数处理，直接使用wrapper返回的descriptor
      // 不进行额外的包装，让wrapper函数完全控制行为

    } else {
      // 没有wrapper函数，处理TypeScript字段初始化器和默认值逻辑
      if (finalDescriptor && finalDescriptor.get) {
        const originalGet = finalDescriptor.get;
        const originalSet = finalDescriptor.set;
        
        // 包装getter以检测字段初始化器冲突并提供默认值支持
        finalDescriptor.get = function(this: any) {
          // 如果实例上有直接属性，说明被字段初始化器覆盖了
          if (this.hasOwnProperty(propertyKey)) {
            const instanceValue = this[propertyKey];
            
            // 仅在有默认值配置且实例值与默认值不同时发出提示
            if (metadata.config?.defaultValue !== undefined && instanceValue !== metadata.config.defaultValue) {
              PropertyDecoratorManager.getInstance().logger.Debug(
                `Property '${String(propertyKey)}' has field initializer (value: "${instanceValue}") that takes precedence over decorator defaultValue (value: "${metadata.config.defaultValue}"). ` +
                `This is expected behavior. To use decorator defaultValue, remove the field initializer or use constructor assignment.`
              );
            }
            
            // 返回实例值（这是预期行为）
            return instanceValue;
          }
          
          // 如果实例上没有直接属性，调用原始getter
          return originalGet.call(this);
        };
        
        // 保持原有的setter
        if (originalSet) {
          finalDescriptor.set = originalSet;
        }
      } else if (finalDescriptor && !finalDescriptor.get && !finalDescriptor.set) {
        // 如果没有getter/setter，但有默认值配置，创建基本的getter/setter
        if (metadata.config?.defaultValue !== undefined) {
          const privateKey = `_${String(propertyKey)}`;
          finalDescriptor.get = function(this: any) {
            if (!(privateKey in this)) {
              this[privateKey] = metadata.config.defaultValue;
            }
            return this[privateKey];
          };
          
          finalDescriptor.set = function(this: any, value: any) {
            this[privateKey] = value;
          };
          
          finalDescriptor.enumerable = true;
          finalDescriptor.configurable = true;
          delete finalDescriptor.value;
          delete finalDescriptor.writable;
        }
      }
    }

    return finalDescriptor;
  }

  /**
   * Create a default property descriptor when none exists
   * @param target - Target object
   * @param propertyKey - Property name
   * @param metadata - Decorator metadata
   * @returns Default property descriptor
   */
  private createDefaultDescriptor(
    target: any,
    propertyKey: string | symbol,
    metadata: PropertyDecoratorMetadata
  ): PropertyDescriptor {
    return this.createOptimizedWrapper(target, propertyKey, metadata);
  }

  /**
   * Mark a property as decorated
   * @param target - Target object
   * @param propertyKey - Property name
   * @param decorators - Applied decorators
   */
  private markAsDecorated(target: unknown, propertyKey: string, decorators: Map<string, DecoratorMetadata>): void {
    // Mark the target's property as decorated
    if (!target || typeof target !== 'object') {
      return;
    }

    const decoratedProps = (target as any)[PropertyDecoratorManager.DECORATED_SYMBOL] || new Set();
    decoratedProps.add(propertyKey);

    Object.defineProperty(target, PropertyDecoratorManager.DECORATED_SYMBOL, {
      value: decoratedProps,
      writable: false,
      enumerable: false,
      configurable: true
    });

    // Store metadata for the property
    const metadataMap = (target as any)[PropertyDecoratorManager.METADATA_SYMBOL] || new Map();
    metadataMap.set(propertyKey, decorators);

    Object.defineProperty(target, PropertyDecoratorManager.METADATA_SYMBOL, {
      value: metadataMap,
      writable: false,
      enumerable: false,
      configurable: true
    });
  }

  /**
   * Check if a property is decorated
   * @param target - Target object
   * @param propertyKey - Property name
   * @returns true if decorated, false otherwise
   */
  isDecorated(target: unknown, propertyKey: string): boolean {
    if (!target || typeof target !== 'object') {
      return false;
    }
    const decoratedProps = (target as any)[PropertyDecoratorManager.DECORATED_SYMBOL];
    return decoratedProps ? decoratedProps.has(propertyKey) : false;
  }

  /**
   * Get decorator metadata for a property
   * @param target - Target object
   * @param propertyKey - Property name
   * @returns Decorator metadata map
   */
  getDecoratorMetadata(target: unknown, propertyKey: string): Map<string, DecoratorMetadata> | null {
    if (!target || typeof target !== 'object') {
      return null;
    }
    const metadataMap = (target as any)[PropertyDecoratorManager.METADATA_SYMBOL];
    return metadataMap ? metadataMap.get(propertyKey) : null;
  }

  /**
   * Get property wrapper information
   * @param target - Target object
   * @param propertyKey - Property name
   * @returns Property wrapper or null
   */
  getPropertyWrapper(target: unknown, propertyKey: string): PropertyWrapper | null {
    const key = this.generatePropertyKey(target, propertyKey);
    return this.propertyRegistry.get(key) || null;
  }

  /**
   * Clear all cached wrappers (useful for testing)
   */
  clearCache(): void {
    this.wrapperCache.clear();
    this.propertyRegistry.clear();
    logger.Debug('Property decorator wrapper cache cleared');
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
   * Get all decorated properties
   * @returns Array of decorated property information
   */
  getDecoratedProperties(): Array<{
    target: unknown;
    propertyName: string;
    decorators: string[];
    isWrapped: boolean
  }> {
    const result: Array<{
      target: unknown;
      propertyName: string;
      decorators: string[];
      isWrapped: boolean
    }> = [];

    this.propertyRegistry.forEach((wrapper) => {
      result.push({
        target: wrapper.target,
        propertyName: wrapper.propertyName,
        decorators: Array.from(wrapper.decorators.keys()),
        isWrapped: wrapper.isWrapped
      });
    });

    return result;
  }

  /**
   * Remove a property wrapper
   * @param target - Target object
   * @param propertyKey - Property name
   * @returns true if removed, false otherwise
   */
  removePropertyWrapper(target: unknown, propertyKey: string): boolean {
    const key = this.generatePropertyKey(target, propertyKey);
    const removed = this.propertyRegistry.delete(key);

    if (removed) {
      logger.Debug(`Removed property wrapper for ${propertyKey}`);
    }

    return removed;
  }
} 