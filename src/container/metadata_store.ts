import * as helper from "koatty_lib";
import { MetadataCache } from "../utils/cache";

export class MetadataStore {
  private metadataMap: WeakMap<object | Function, Map<string | symbol, any>>;
  private metadataCache: MetadataCache;

  constructor(metadataCache: MetadataCache) {
    this.metadataMap = new WeakMap();
    this.metadataCache = metadataCache;
  }

  public getMetadataMap<T = any>(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol): T {
    if (typeof target === "object" && target.constructor) {
      target = target.constructor;
    }
    if (!this.metadataMap.has(target)) {
      this.metadataMap.set(target, new Map());
    }
    const key = propertyKey ? `${helper.toString(metadataKey)}:${helper.toString(propertyKey)}` : metadataKey;
    const map = this.metadataMap.get(target);
    if (!map!.has(key)) {
      map!.set(key, new Map());
    }
    return map!.get(key) as T;
  }

  public saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    originMap.set(decoratorNameKey, data);
    this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, data, propertyName);
  }

  public getClassMetadata<T = any>(type: string, decoratorNameKey: string | symbol, target: Function | object,
    propertyName?: string): T {
    const cachedValue = this.metadataCache.getClassMetadata(type, String(decoratorNameKey), target, propertyName);
    if (cachedValue !== undefined) {
      return cachedValue as T;
    }
    const originMap = this.getMetadataMap(type, target, propertyName);
    const value = originMap.get(decoratorNameKey);
    if (value !== undefined) {
      this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, value, propertyName);
    }
    return value as T;
  }

  public attachClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    if (!originMap.has(decoratorNameKey)) {
      originMap.set(decoratorNameKey, []);
    }
    originMap.get(decoratorNameKey).push(data);
    const currentValue = this.metadataCache.getClassMetadata(type, String(decoratorNameKey), target, propertyName) || [];
    currentValue.push(data);
    this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, currentValue, propertyName);
  }

  public savePropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    originMap.set(propertyName, data);
    this.metadataCache.setPropertyMetadata(String(decoratorNameKey), target, propertyName, data);
  }

  public attachPropertyData(decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName: string | symbol) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    if (!originMap.has(propertyName)) {
      originMap.set(propertyName, []);
    }
    originMap.get(propertyName).push(data);
    const currentValue = this.metadataCache.getPropertyMetadata(String(decoratorNameKey), target, propertyName) || [];
    currentValue.push(data);
    this.metadataCache.setPropertyMetadata(String(decoratorNameKey), target, propertyName, currentValue);
  }

  public getPropertyData<T = any>(decoratorNameKey: string | symbol, target: Function | object,
    propertyName: string | symbol): T {
    const cachedValue = this.metadataCache.getPropertyMetadata(String(decoratorNameKey), target, propertyName);
    if (cachedValue !== undefined) {
      return cachedValue as T;
    }
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    const value = originMap.get(propertyName);
    if (value !== undefined) {
      this.metadataCache.setPropertyMetadata(String(decoratorNameKey), target, propertyName, value);
    }
    return value as T;
  }

  public listPropertyData<T = Record<string, any>>(decoratorNameKey: string | symbol, target: Function | object): T {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    const data: any = {};
    for (const [key, value] of originMap) {
      data[key] = value;
    }
    return data as T;
  }

  public clear(): void {
    this.metadataMap = new WeakMap();
    this.metadataCache.clear();
  }
}
