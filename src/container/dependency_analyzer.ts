/**
 * Dependency Analyzer
 * Analyzes component dependencies, detects circular dependencies, and generates reports.
 * Extracted from Container class to follow Single Responsibility Principle.
 */
import { TAGGED_PROP } from "./icontainer";
import { DefaultLogger as logger } from "koatty_logger";
import { getComponentTypeByClassName } from "../utils/operator";
import { CircularDepDetector } from "../utils/circular";
import { MetadataCache } from "../utils/cache";

export class DependencyAnalyzer {
  constructor(
    private circularDependencyDetector: CircularDepDetector,
    private metadataCache: MetadataCache,
    private getClassFn: (id: string, type: string) => Function | undefined,
    private listPropertyDataFn: (key: string | symbol, target: Function | object) => any
  ) {}

  /**
   * Extract dependencies from a target class
   * @param target The target class to extract dependencies from
   * @returns An array of dependency identifiers
   */
  public extractDependencies(target: any): string[] {
    // Check cache first
    const cachedDependencies = this.metadataCache.getCachedDependencies(target);
    if (cachedDependencies) {
      return cachedDependencies;
    }

    const dependencies: string[] = [];

    try {
      // get constructor parameter types with caching
      let paramTypes = this.metadataCache.getReflectMetadata('design:paramtypes', target);
      if (!paramTypes) {
        paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
        this.metadataCache.setReflectMetadata('design:paramtypes', target, paramTypes);
      }

      paramTypes.forEach((type: any) => {
        if (type && type.name) {
          dependencies.push(type.name);
        }
      });

      // Get @Autowired decorated properties using listPropertyData method
      const autowiredProperties = this.listPropertyDataFn(TAGGED_PROP, target);
      if (autowiredProperties && typeof autowiredProperties === 'object') {
        for (const [propertyKey, metadata] of Object.entries(autowiredProperties)) {
          if (metadata && typeof metadata === 'object') {
            const propertyMetadata = metadata as any;
            // Get the dependency identifier from @Autowired metadata
            const dependencyId = propertyMetadata.identifier || propertyMetadata.name || propertyKey;
            if (dependencyId && !dependencies.includes(dependencyId)) {
              dependencies.push(dependencyId);
            }
          }
        }
      }
    } catch (error) {
      logger.Debug(`Failed to extract dependencies of ${target.name}:`, error);
    }

    // Cache the extracted dependencies
    this.metadataCache.setCachedDependencies(target, dependencies);

    logger.Debug(`Register component dependencies: ${target.name} -> [${dependencies.join(', ')}]`);

    return dependencies;
  }

  /**
   * Check strict lifetime constraint: Singleton cannot depend on Prototype
   * @param id The identifier of the component being registered
   * @param dependencies Array of dependency identifiers
   * @param type The component type
   * @throws {Error} When Singleton depends on Prototype
   */
  public checkStrictLifetime(id: string, dependencies: string[], _type: string): void {
    for (const dep of dependencies) {
      const depType = getComponentTypeByClassName(dep);
      const depClass = this.getClassFn(dep, depType);
      if (depClass) {
        const depOptions = Reflect.get((depClass as Function).prototype, '_options');
        if (depOptions?.scope === 'Prototype') {
          throw new Error(`Strict Mode: Singleton '${id}' cannot depend on Prototype '${dep}'`);
        }
      }
    }
  }

  /**
   * Generate and log dependency analysis report
   */
  public generateDependencyReport(): void {
    const report = this.circularDependencyDetector.generateDependencyReport();

    logger.Info("=== Dependency analysis report ===");
    logger.Info(`Total components: ${report.totalComponents}`);
    logger.Info(`Resolved components: ${report.resolvedComponents}`);
    logger.Info(`Unresolved components: ${report.unresolvedComponents.length}`);

    if (report.circularDependencies.length > 0) {
      logger.Warn(`Found ${report.circularDependencies.length} circular dependencies:`);
      report.circularDependencies.forEach((cycle, index) => {
        logger.Warn(`  ${index + 1}. ${cycle.join(' -> ')}`);

        // provide resolution suggestions
        const suggestions = this.circularDependencyDetector.getResolutionSuggestions(cycle);
        suggestions.forEach(suggestion => logger.Info(`     ${suggestion}`));
      });
    } else {
      logger.Info("✓ No circular dependencies found");
    }

    if (report.unresolvedComponents.length > 0) {
      logger.Warn("Unresolved components:");
      report.unresolvedComponents.forEach(comp => logger.Warn(`  - ${comp}`));
    }

    // output dependency graph visualization
    logger.Debug(this.circularDependencyDetector.getDependencyGraphVisualization());
  }

  /**
   * Check for circular dependencies in the container
   * @returns True if circular dependencies exist
   */
  public hasCircularDependencies(): boolean {
    return this.circularDependencyDetector.hasCircularDependencies();
  }

  /**
   * Get all circular dependencies
   * @returns Array of circular dependency paths
   */
  public getCircularDependencies(): string[][] {
    return this.circularDependencyDetector.getAllCircularDependencies();
  }
}
