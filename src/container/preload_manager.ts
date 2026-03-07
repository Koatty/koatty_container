import { MetadataCache, CacheType } from "../utils/cache";
import { DefaultLogger as logger } from "koatty_logger";
import { TAGGED_CLS, TAGGED_PROP, TAGGED_AOP, IContainer } from "./icontainer";
import { batchPreprocessDependencies, optimizeDependencyCache } from "../processor/autowired_processor";
import { warmupAOPCache, optimizeAOPCache } from "../processor/aop_processor";

export class PreloadManager {
  constructor(
    private metadataCache: MetadataCache,
    private listClassFn: (type: string) => { id: string; target: Function }[],
    private getDetailedStatsFn: () => any,
    private clearPerformanceCacheFn: () => void,
    private calculateTotalCacheSizeFn: (lruCaches: any) => string,
    private classMap: Map<string, Function>,
    private container: IContainer
  ) {}

  public preloadMetadata(types: string[] = [], options: {
    optimizePerformance?: boolean;
    warmupCaches?: boolean;
    batchPreProcessDependencies?: boolean;
    clearStaleCache?: boolean;
  } = {}): void {
    const {
      optimizePerformance = true,
      warmupCaches = true,
      batchPreProcessDependencies = true,
      clearStaleCache = false
    } = options;

    const startTime = Date.now();

    const targetTypes = types.length > 0 ? types : ["CONTROLLER", "SERVICE", "COMPONENT"];

    logger.Info(`Starting ${optimizePerformance ? 'optimized' : 'standard'} metadata preload for types: [${targetTypes.join(', ')}]...`);

    if (optimizePerformance) {
      if (clearStaleCache) {
        this.clearPerformanceCacheFn();
        logger.Debug("Performance caches cleared before preload");
      }

      this.metadataCache.optimize();
    }

    const sortedTypes = targetTypes.sort((a, b) => {
      const aCount = this.listClassFn(a).length;
      const bCount = this.listClassFn(b).length;
      return bCount - aCount;
    });

    let totalProcessed = 0;
    const allTargets: Function[] = [];

    for (const type of sortedTypes) {
      const typeStartTime = Date.now();

      const componentsToPreload = this.listClassFn(type);

      if (componentsToPreload.length === 0) {
        logger.Debug(`No components found for type: ${type}`);
        continue;
      }

      const typeTargets = componentsToPreload.map(c => c.target);
      allTargets.push(...typeTargets);

      const preloadKeys: string[] = [];

      componentsToPreload.forEach(({ target, id }) => {
        const [, identifier] = id.split(':');

        preloadKeys.push(
          `reflect:design:paramtypes:${identifier}`,
          `property:${TAGGED_PROP}:${identifier}`,
          `class:${TAGGED_CLS}:${TAGGED_AOP}:${identifier}`,
          `reflect:autowired:${identifier}`,
          `reflect:values:${identifier}`
        );

        const propertyNames = Object.getOwnPropertyNames(target.prototype);
        propertyNames.forEach(propName => {
          if (propName !== 'constructor') {
            preloadKeys.push(
              `reflect:${propName}:autowired:${identifier}`,
              `reflect:${propName}:values:${identifier}`
            );
          }
        });
      });

      this.metadataCache.registerForPreload(preloadKeys);

      let preloadedCount = 0;
      this.metadataCache.preload(CacheType.REFLECT_METADATA, (key: string) => {
        try {
          const parts = key.split(':');
          const [cacheType, metadataKey, targetName, propertyKey] = parts;

          if (!targetName) return undefined;
          const target = this.findTargetByName(targetName);
          if (!target) return undefined;

          if (cacheType === 'reflect') {
            const value = propertyKey && propertyKey !== targetName
              ? Reflect.getMetadata(metadataKey, target, propertyKey)
              : Reflect.getMetadata(metadataKey, target);

            if (value !== undefined) {
              preloadedCount++;
            }
            return value;
          }

          return undefined;
        } catch (error) {
          logger.Debug(`Failed to preload metadata for key ${key}:`, error);
          return undefined;
        }
      });

      const typeTime = Date.now() - typeStartTime;
      totalProcessed += componentsToPreload.length;

      logger.Debug(`Processed ${type}: ${componentsToPreload.length} components, ${preloadedCount} metadata entries in ${typeTime}ms`);
    }

    if (batchPreProcessDependencies && optimizePerformance && allTargets.length > 0) {
      try {
        batchPreprocessDependencies(allTargets, this.container);
        logger.Debug(`Batch dependency preprocessing completed for ${allTargets.length} targets`);
      } catch (error) {
        logger.Debug("Batch dependency preprocessing failed:", error);
      }
    }

    if (warmupCaches && optimizePerformance && allTargets.length > 0) {
      try {
        warmupAOPCache(allTargets, this.container);
        logger.Debug(`AOP cache warmup completed for ${allTargets.length} targets`);
      } catch (error) {
        logger.Debug("AOP cache warmup failed:", error);
      }
    }

    if (optimizePerformance) {
      try {
        optimizeDependencyCache();
      } catch (error) {
        logger.Debug("Dependency cache optimization failed:", error);
      }

      try {
        optimizeAOPCache();
      } catch (error) {
        logger.Debug("AOP cache optimization failed:", error);
      }
    }

    const totalTime = Date.now() - startTime;
    const cacheStats = this.metadataCache.getStats();

    if (optimizePerformance) {
      const detailedStats = this.getDetailedStatsFn();

      logger.Info(`Optimized metadata preload completed in ${totalTime}ms:`);
      logger.Info(`  - Types processed: [${sortedTypes.join(', ')}]`);
      logger.Info(`  - Total components: ${totalProcessed}`);
      logger.Info(`  - Metadata cache hit rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);

      if (detailedStats.lruCaches.dependencies) {
        logger.Info(`  - Dependencies cache hit rate: ${(detailedStats.lruCaches.dependencies.hitRate * 100).toFixed(2)}%`);
      }

      if (detailedStats.lruCaches.aop) {
        logger.Info(`  - AOP cache hit rate: ${(detailedStats.lruCaches.aop.hitRates.overall * 100).toFixed(2)}%`);
      }

      logger.Info(`  - Total cache size: ${this.calculateTotalCacheSizeFn(detailedStats.lruCaches)}`);
    } else {
      logger.Info(`Standard metadata preload completed in ${totalTime}ms:`);
      logger.Info(`  - Types processed: [${sortedTypes.join(', ')}]`);
      logger.Info(`  - Total components: ${totalProcessed}`);
      logger.Info(`  - Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
    }
  }

  private findTargetByName(name: string): Function | undefined {
    for (const [, target] of this.classMap) {
      if (target.name === name) {
        return target;
      }
    }
    return undefined;
  }
}
