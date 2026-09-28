/**
 * Lifecycle Manager
 * Manages instance lifecycle including creation, caching, and disposal.
 * Extracted from Container class to follow Single Responsibility Principle.
 */
import * as helper from "koatty_lib";
import { overridePrototypeValue } from "../utils/operator";
import { ObjectDefinitionOptions } from "./icontainer";

import { POST_CONSTRUCT, PRE_DESTROY } from '../decorator/lifecycle';

export function hookNames(instance: any, tag: symbol, configured?: string): string[] {
  const names = new Set<string>();
  for (let proto = instance; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (typeof Object.getOwnPropertyDescriptor(proto, name)?.value === 'function' && instance[name]?.[tag]) names.add(name);
    }
  }
  if (!names.size && configured && configured !== 'constructor' && configured !== 'destroy' && configured !== 'destructor' && typeof instance[configured] !== 'function') {
    throw new Error(`Lifecycle method ${configured} is not a function`);
  }
  if (!names.size && configured && configured !== 'constructor' && typeof instance[configured] === 'function') names.add(configured);
  return [...names];
}

export class LifecycleManager {
  private entries: Array<{ instance: any; options: ObjectDefinitionOptions; initialized: Promise<void> }> = [];
  private plainSingletons: object[] = [];
  private disposal?: Promise<void>;
  private instanceMap: WeakMap<object | Function, any>;

  constructor(private prepare?: (target: Function, instance: any, options: ObjectDefinitionOptions) => void) {
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
    if (this.instanceMap.has(target)) return;
    const constructorArgs = options?.args || [];
    const instance = Reflect.construct(<Function>target, constructorArgs);
    overridePrototypeValue(instance);
    this.instanceMap.set(target, instance);
    try { this.prepare?.(target as Function, instance, options); } catch (error) { this.instanceMap.delete(target); throw error; }
    this.trackInstance(instance, options);
  }

  public trackInstance(instance: any, options: ObjectDefinitionOptions): void {
    const initializers = hookNames(instance, POST_CONSTRUCT, options?.initMethod);
    const destructors = hookNames(instance, PRE_DESTROY, options?.destroyMethod);
    if (!initializers.length && !destructors.length) {
      if (options.scope === 'Singleton') this.plainSingletons.push(instance);
      return;
    }
    const previous = this.entries[this.entries.length - 1]?.initialized ?? Promise.resolve();
    const initialized = previous.then(async () => {
      for (const name of initializers) await instance[name]();
    });
    // Retain rejection for ready()/clear() without creating an unhandled rejection during registration.
    initialized.catch(() => undefined);
    this.entries.push({ instance, options, initialized });
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
    }
    return instance;
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
  public get hasLifecycleHooks(): boolean { return this.entries.length > 0; }

  public async ready(): Promise<void> {
    for (const entry of this.entries) await entry.initialized;
  }

  public seal(): void {
    for (const instance of this.plainSingletons) Object.seal(instance);
    for (const entry of this.entries) {
      if (entry.options.scope === 'Singleton') Object.seal(entry.instance);
    }
  }

  public clear(): Promise<void> {
    this.plainSingletons = [];
    if (!this.entries.length) { this.instanceMap = new WeakMap(); return this.disposal ?? Promise.resolve(); }
    const entries = this.entries.splice(0).reverse();
    this.instanceMap = new WeakMap();
    this.disposal = (async () => {
      const errors: unknown[] = [];
      for (const entry of entries) {
        try { await entry.initialized; } catch (error) { errors.push(error); }
        try {
          for (const name of hookNames(entry.instance, PRE_DESTROY, entry.options.destroyMethod)) await entry.instance[name]();
        } catch (error) { errors.push(error); }
      }
      if (errors.length) throw errors[0];
    })();
    return this.disposal;
  }

  public dispose(): Promise<void> { return this.clear(); }
}
