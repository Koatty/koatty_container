import { MetadataCache } from "../utils/cache";
import { CircularDepDetector } from "../utils/circular";
import { getAutowiredCacheStats, clearDependencyCache } from "../processor/autowired_processor";
import { getAOPCacheStats, clearAOPCache } from "../processor/aop_processor";
import { DefaultLogger as logger } from "koatty_logger";

export class PerformanceManager {
  constructor(
    private metadataCache: MetadataCache,
    private classMap: Map<string, Function>,
    private circularDependencyDetector: CircularDepDetector,
    private listClassFn: (type: string) => { id: string; target: Function }[]
  ) {}

  public getPerformanceStats(): {
    cache: Record<string, unknown>;
    totalRegistered: number;
    memoryUsage: {
      classMap: number;
      instanceMap: number;
      metadataMap: number;
    };
  } {
    const cacheStats = this.metadataCache.getStats();

    return {
      cache: cacheStats as unknown as Record<string, unknown>,
      totalRegistered: this.classMap.size,
      memoryUsage: {
        classMap: this.classMap.size,
        instanceMap: this.getInstanceMapSize(),
        metadataMap: this.getMetadataMapSize()
      }
    };
  }

  public getDetailedPerformanceStats(): {
    cache: any;
    containers: {
      totalRegistered: number;
      byType: Record<string, number>;
      memoryUsage: {
        classMap: number;
        instanceMap: number;
        metadataMap: number;
      };
    };
    hotspots: {
      mostAccessedTypes: string[];
      circularDependencies: number;
    };
    lruCaches: {
      metadata: any;
      dependencies?: any;
      aop?: any;
    };
  } {
    const cacheStats = this.metadataCache.getStats();

    const typeStats: Record<string, number> = {};
    const typeOrder = ["CONTROLLER", "SERVICE", "COMPONENT", "REPOSITORY"];

    for (const type of typeOrder) {
      typeStats[type] = this.listClassFn(type).length;
    }

    const circularCount = this.circularDependencyDetector.getAllCircularDependencies().length;
    const mostAccessedTypes = Object.entries(typeStats)
      .sort(([, a], [, b]) => b - a)
      .map(([type]) => type);

    const lruCaches: any = {
      metadata: cacheStats
    };

    try {
      lruCaches.dependencies = getAutowiredCacheStats();
    } catch (error) {
      logger.Debug("Failed to get dependency cache stats:", error);
    }

    try {
      lruCaches.aop = getAOPCacheStats();
    } catch (error) {
      logger.Debug("Failed to get AOP cache stats:", error);
    }

    return {
      cache: cacheStats,
      containers: {
        totalRegistered: this.classMap.size,
        byType: typeStats,
        memoryUsage: {
          classMap: this.classMap.size,
          instanceMap: this.getInstanceMapSize(),
          metadataMap: this.getMetadataMapSize()
        }
      },
      hotspots: {
        mostAccessedTypes,
        circularDependencies: circularCount
      },
      lruCaches
    };
  }

  public clearPerformanceCache(): void {
    this.metadataCache.clear();

    try {
      clearDependencyCache();
    } catch (error) {
      logger.Debug("Autowired cache cleanup failed:", error);
    }

    try {
      clearAOPCache();
    } catch (error) {
      logger.Debug("AOP cache cleanup failed:", error);
    }

    logger.Debug("Performance cache cleared");
  }

  public calculateTotalCacheSize(lruCaches: any): string {
    let totalSize = 0;

    if (lruCaches.metadata && lruCaches.metadata.memoryUsage) {
      totalSize += lruCaches.metadata.memoryUsage;
    }

    if (lruCaches.dependencies && lruCaches.dependencies.cacheSize) {
      totalSize += lruCaches.dependencies.cacheSize * 1024;
    }

    if (lruCaches.aop && lruCaches.aop.cacheSize) {
      const aopSize = lruCaches.aop.cacheSize;
      totalSize += (aopSize.aspects + aopSize.methodNames + aopSize.interceptors) * 2048;
    }

    return `${(totalSize / 1024).toFixed(1)}KB`;
  }

  private getInstanceMapSize(): number {
    return this.classMap.size;
  }

  private getMetadataMapSize(): number {
    return this.classMap.size * 3;
  }
}
