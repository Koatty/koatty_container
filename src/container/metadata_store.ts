import * as helper from "koatty_lib";
import { MetadataCache } from "../utils/cache";

export class MetadataStore {
  private metadataMap: WeakMap<object | Function, Map<string | symbol, any>>;
  private metadataCache: MetadataCache;

  constructor(metadataCache: MetadataCache) {
    this.metadataMap = new WeakMap();
    this.metadataCache = metadataCache;
  }

  public getMetadataMap(metadataKey: string | symbol, target: Function | object, propertyKey?: string | symbol) {
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
    return map!.get(key);
  }

  public saveClassMetadata(type: string, decoratorNameKey: string | symbol, data: any, target: Function | object,
    propertyName?: string) {
    const originMap = this.getMetadataMap(type, target, propertyName);
    originMap.set(decoratorNameKey, data);
    this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, data, propertyName);
  }

  public getClassMetadata(type: string, decoratorNameKey: string | symbol, target: Function | object,
    propertyName?: string) {
    const cachedValue = this.metadataCache.getClassMetadata(type, String(decoratorNameKey), target, propertyName);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    const originMap = this.getMetadataMap(type, target, propertyName);
    const value = originMap.get(decoratorNameKey);
    if (value !== undefined) {
      this.metadataCache.setClassMetadata(type, String(decoratorNameKey), target, value, propertyName);
    }
    return value;
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

  public getPropertyData(decoratorNameKey: string | symbol, target: Function | object,
    propertyName: string | symbol) {
    const cachedValue = this.metadataCache.getPropertyMetadata(String(decoratorNameKey), target, propertyName);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    const value = originMap.get(propertyName);
    if (value !== undefined) {
      this.metadataCache.setPropertyMetadata(String(decoratorNameKey), target, propertyName, value);
    }
    return value;
  }

  public listPropertyData(decoratorNameKey: string | symbol, target: Function | object) {
    const originMap = this.getMetadataMap(decoratorNameKey, target);
    const data: any = {};
    for (const [key, value] of originMap) {
      data[key] = value;
    }
    return data;
  }

  public clear(): void {
    this.metadataMap = new WeakMap();
    this.metadataCache.clear();
  }
}
