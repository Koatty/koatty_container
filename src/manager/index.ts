/*
 * @Description: Unified decorator manager entry point
 * @Usage: 
 * @Author: richen
 * @Date: 2024-01-17 16:00:00
 * @LastEditTime: 2024-01-17 16:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { MethodDecoratorManager } from './method';
import { ClassDecoratorManager } from './class';
import { PropertyDecoratorManager } from './property';

// Export types
export type { MethodDecoratorManager, MethodWrapperFunction } from './method';
export type { ClassDecoratorManager, ClassWrapperFunction } from './class';
export type { PropertyDecoratorManager, PropertyWrapperFunction } from './property';
export type { DecoratorMetadata } from './type';

/**
 * Unified decorator manager that provides access to all decorator types
 * This is a convenient facade for accessing all decorator managers
 */
export class DecoratorManagerFacade {
  private static _instance: DecoratorManagerFacade;
  
  // Lazy-loaded manager instances
  private _methodManager?: MethodDecoratorManager;
  private _classManager?: ClassDecoratorManager;
  private _propertyManager?: PropertyDecoratorManager;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DecoratorManagerFacade {
    if (!DecoratorManagerFacade._instance) {
      DecoratorManagerFacade._instance = new DecoratorManagerFacade();
    }
    return DecoratorManagerFacade._instance;
  }

  /**
   * Get method decorator manager instance
   */
  public get method(): MethodDecoratorManager {
    if (!this._methodManager) {
      this._methodManager = MethodDecoratorManager.getInstance();
    }
    return this._methodManager;
  }

  /**
   * Get class decorator manager instance
   */
  public get class(): ClassDecoratorManager {
    if (!this._classManager) {
      this._classManager = ClassDecoratorManager.getInstance();
    }
    return this._classManager;
  }

  /**
   * Get property decorator manager instance
   */
  public get property(): PropertyDecoratorManager {
    if (!this._propertyManager) {
      this._propertyManager = PropertyDecoratorManager.getInstance();
    }
    return this._propertyManager;
  }

  /**
   * Clear all caches across all managers
   */
  public clearAllCaches(): void {
    this.method.clearCache();
    this.class.clearCache();
    this.property.clearCache();
  }

  /**
   * Get comprehensive statistics from all managers
   */
  public getAllStats(): {
    method: { size: number; keys: string[] };
    class: { size: number; keys: string[] };
    property: { size: number; keys: string[] };
  } {
    return {
      method: this.method.getCacheStats(),
      class: this.class.getCacheStats(),
      property: this.property.getCacheStats()
    };
  }

  /**
   * Check if any wrapper is registered for the given decorator type across all managers
   */
  public hasAnyWrapper(decoratorType: string): {
    method: boolean;
    class: boolean;
    property: boolean;
  } {
    return {
      method: this.method.hasWrapper(decoratorType),
      class: this.class.hasWrapper(decoratorType),
      property: this.property.hasWrapper(decoratorType)
    };
  }

  /**
   * Get all registered wrapper types across all managers
   */
  public getAllRegisteredTypes(): {
    method: string[];
    class: string[];
    property: string[];
  } {
    return {
      method: this.method.getRegisteredTypes(),
      class: this.class.getRegisteredTypes(),
      property: this.property.getRegisteredTypes()
    };
  }
}

// Export the facade instance for convenience
export const decoratorManager = DecoratorManagerFacade.getInstance(); 