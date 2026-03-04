/**
 * Lifecycle Manager
 * Manages instance lifecycle including creation, caching, and disposal.
 * Extracted from Container class to follow Single Responsibility Principle.
 */
import * as helper from "koatty_lib";
import { overridePrototypeValue } from "../utils/operator";
import { ObjectDefinitionOptions } from "./icontainer";

export class LifecycleManager {
  private instanceMap: WeakMap<object | Function, any>;

  constructor() {
    this.instanceMap = new WeakMap();
  }

  /**
   * Set instance to container.
   * @param target The target class or function to be instantiated
   * @param options Instance definition options
   * @description Create an instance of the target class with given options and store it in the container.
   * If scope is Singleton, the instance will be sealed to prevent modifications.
   */
  public setInstance<T extends object | Function>(target: T, options: ObjectDefinitionOptions): void {
    const constructorArgs = options?.args || [];
    const instance = Reflect.construct(<Function>target, constructorArgs);
    overridePrototypeValue(instance);
    if (options?.scope === "Singleton") {
      Object.seal(instance);
    }
    this.instanceMap.set(target, instance);
  }

  /**
   * Get instance by class constructor
   * @param target The class constructor
   * @param args Constructor parameters
   * @returns Instance of the class or null if target is not a class
   * @template T Type of the class instance or function
   * @description Get instance of the class
   */
  public getInsByClass<T extends object | Function>(target: T, args: any[] = []): T {
    if (!helper.isClass(target)) {
      throw new Error(`getInsByClass: target is not a class`);
    }
    const instance: any = this.instanceMap.get(target);
    if (args.length > 0) {
      return Reflect.construct(<Function><unknown>target, args);
    } else {
      return instance;
    }
  }

  /**
   * Get cached instance by target
   * @param target The class constructor
   * @returns The cached instance or undefined
   */
  public getInstance<T extends object | Function>(target: T): T | undefined {
    return this.instanceMap.get(target);
  }

  /**
   * Check if instance exists for target
   * @param target The class constructor
   * @returns True if instance exists
   */
  public hasInstance(target: object | Function): boolean {
    return this.instanceMap.has(target);
  }

  /**
   * Clear all instances
   */
  public clear(): void {
    this.instanceMap = new WeakMap();
  }

  /**
   * Dispose all resources
   * Prepared for future Disposable interface support (Symbol.dispose)
   */
  public dispose(): void {
    this.clear();
  }
}
