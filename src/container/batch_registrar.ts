import { DefaultLogger as logger } from "koatty_logger";
import { ObjectDefinitionOptions } from "./icontainer";
import { getComponentTypeByClassName } from "../utils/operator";

export class BatchRegistrar {
  constructor(
    private regFn: (id: string, target: any, options?: ObjectDefinitionOptions) => void,
    private getIdentifierFn: (target: Function | object) => string,
    private getTypeFn: (target: Function | object) => any,
    private extractDependenciesFn: (target: any) => string[],
    private preloadMetadataFn: (types: string[], options: any) => void
  ) {}

  public batchRegister(components: { target: Function, identifier?: string, options?: ObjectDefinitionOptions }[],
    batchOptions: { preProcessDependencies?: boolean, warmupAOP?: boolean } = {}): void {
    const startTime = Date.now();
    logger.Info(`Starting batch registration for ${components.length} components...`);

    try {
      if (batchOptions.preProcessDependencies || batchOptions.warmupAOP) {
        const componentTypes = [...new Set(components.map(c => {
          const identifier = c.identifier || this.getIdentifierFn(c.target);
          return this.getTypeFn(c.target) || getComponentTypeByClassName(identifier);
        }))];

        this.preloadMetadataFn(componentTypes, {
          optimizePerformance: true,
          batchPreProcessDependencies: batchOptions.preProcessDependencies,
          warmupCaches: batchOptions.warmupAOP,
          clearStaleCache: false
        });

        logger.Debug(`Integrated optimization completed for types: [${componentTypes.join(', ')}]`);
      }

      const sortedComponents = this.topologicalSortComponents(components);

      let successCount = 0;
      for (const component of sortedComponents) {
        try {
          const { target, identifier, options } = component;
          const id = identifier || this.getIdentifierFn(target);
          this.regFn(id, target, options);
          successCount++;
        } catch (error) {
          logger.Error(`Failed to register component ${component.identifier || component.target.name}:`, error);
        }
      }

      const totalTime = Date.now() - startTime;
      logger.Info(`Batch registration completed: ${successCount}/${components.length} components registered in ${totalTime}ms`);

    } catch (error) {
      logger.Error("Batch registration failed:", error);
      throw error;
    }
  }

  private topologicalSortComponents(components: { target: Function, identifier?: string, options?: ObjectDefinitionOptions }[]): typeof components {
    const dependencyGraph = new Map<string, string[]>();
    const componentMap = new Map<string, typeof components[0]>();

    for (const component of components) {
      const identifier = component.identifier || this.getIdentifierFn(component.target);
      componentMap.set(identifier, component);

      const dependencies = this.extractDependenciesFn(component.target);
      dependencyGraph.set(identifier, dependencies.filter(dep =>
        components.some(c => (c.identifier || this.getIdentifierFn(c.target)) === dep)
      ));
    }

    const sorted: typeof components = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (identifier: string) => {
      if (visiting.has(identifier)) {
        logger.Warn(`Circular dependency detected involving ${identifier}, using registration order`);
        return;
      }
      if (visited.has(identifier)) return;

      visiting.add(identifier);
      const dependencies = dependencyGraph.get(identifier) || [];

      for (const dep of dependencies) {
        if (componentMap.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(identifier);
      visited.add(identifier);

      const component = componentMap.get(identifier);
      if (component) {
        sorted.push(component);
      }
    };

    for (const component of components) {
      const identifier = component.identifier || this.getIdentifierFn(component.target);
      visit(identifier);
    }

    return sorted;
  }
}
