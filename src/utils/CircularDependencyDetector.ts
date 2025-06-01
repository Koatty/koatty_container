/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { DefaultLogger as logger } from "koatty_logger";

/**
 * Custom error class for circular dependency detection.
 * 
 * @property {string[]} dependencyChain - The full chain of dependencies leading to the circular reference
 * @property {string[]} circularPath - The specific path that forms the circular reference
 * 
 * @method getDetailedMessage - Returns a formatted string with error details including dependency chain and circular path
 * @method toJSON - Converts error to JSON format for logging purposes
 */
export class CircularDependencyError extends Error {
  public readonly dependencyChain: string[];
  public readonly circularPath: string[];

  constructor(message: string, dependencyChain: string[], circularPath: string[]) {
    super(message);
    this.name = 'CircularDependencyError';
    this.dependencyChain = dependencyChain;
    this.circularPath = circularPath;

    // capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircularDependencyError);
    }
  }


  /**
   * Generates a detailed error message for circular dependency detection.
   * Includes the original error message, dependency chain, and circular path.
   * 
   * @returns {string} Formatted error message with dependency details.
   */
  getDetailedMessage(): string {
    return `${this.message}\n` +
           `Dependency Chain: ${this.dependencyChain.join(' -> ')}\n` +
           `Circular Path: ${this.circularPath.join(' -> ')}`;
  }

  /**
   * Converts the error to JSON format for logging purposes.
   * 
   * @returns {Object} JSON representation of the error with dependency details.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      dependencyChain: this.dependencyChain,
      circularPath: this.circularPath
    };
  }
}

/**
 * Dependency node information
 */
interface DependencyNode {
  identifier: string;
  className: string;
  dependencies: string[];
  isResolving: boolean;
  isResolved: boolean;
}

/**
 * Circular dependency detector
 * 
 * Features:
 * - Track dependency graph
 * - Detect circular dependencies
 * - Provide detailed circular path information
 * - Support lazy resolution suggestions
 */
/**
 * A utility class for detecting circular dependencies in a dependency graph.
 * 
 * This class maintains a graph of components and their dependencies, and provides methods to:
 * - Register components and their dependencies
 * - Detect circular dependencies during resolution
 * - Generate reports and visualizations of the dependency graph
 * - Provide resolution suggestions for circular dependencies
 * 
 * The detector uses a depth-first search approach to identify cycles in the dependency graph.
 */
export class CircularDependencyDetector {
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private resolutionStack: string[] = [];
  private visitedInCurrentPath: Set<string> = new Set();

  /**
   * Register a component and its dependencies
   * 
   * @param identifier - The unique identifier for the component
   * @param className - The name of the component class
   * @param dependencies - An array of dependencies for the component
   */
  registerComponent(identifier: string, className: string, dependencies: string[] = []) {
    if (!this.dependencyGraph.has(identifier)) {
      this.dependencyGraph.set(identifier, {
        identifier,
        className,
        dependencies,
        isResolving: false,
        isResolved: false
      });
    } else {
      // update dependencies
      const node = this.dependencyGraph.get(identifier)!;
      node.dependencies = [...new Set([...node.dependencies, ...dependencies])];
    }

    logger.Debug(`Register component dependencies: ${identifier} -> [${dependencies.join(', ')}]`);
  }

  /**
   * Add a dependency relationship
   * 
   * @param from - The identifier of the component that depends on the other
   * @param to - The identifier of the component that is depended on
   */
  addDependency(from: string, to: string) {
    const node = this.dependencyGraph.get(from);
    if (node) {
      if (!node.dependencies.includes(to)) {
        node.dependencies.push(to);
        logger.Debug(`Add dependency relationship: ${from} -> ${to}`);
      }
    }
  }

  /**
   * Start resolving a component
   * 
   * @param identifier - The unique identifier for the component
   */
  startResolving(identifier: string): void {
    const node = this.dependencyGraph.get(identifier);
    if (node) {
      node.isResolving = true;
    }

    // check if the component is already in the current resolution path
    if (this.visitedInCurrentPath.has(identifier)) {
      const circularPath = this.buildCircularPath(identifier);
      throw new CircularDependencyError(
        `Circular dependency detected: ${identifier}`,
        [...this.resolutionStack],
        circularPath
      );
    }

    this.resolutionStack.push(identifier);
    this.visitedInCurrentPath.add(identifier);

    logger.Debug(`Start resolving component: ${identifier}, current path: [${this.resolutionStack.join(' -> ')}]`);
  }

  /**
   * Finish resolving a component
   * 
   * @param identifier - The unique identifier for the component
   */
  finishResolving(identifier: string): void {
    const node = this.dependencyGraph.get(identifier);
    if (node) {
      node.isResolving = false;
      node.isResolved = true;
    }

    // remove the component from the resolution stack
    const index = this.resolutionStack.indexOf(identifier);
    if (index > -1) {
      this.resolutionStack.splice(index, 1);
    }
    this.visitedInCurrentPath.delete(identifier);

    logger.Debug(`Finish resolving component: ${identifier}, remaining path: [${this.resolutionStack.join(' -> ')}]`);
  }

  /**
   * Detect circular dependencies
   * 
   * @param identifier - The unique identifier for the component
   * @returns {string[] | null} The circular path if a cycle is detected, otherwise null
   */
  detectCircularDependency(identifier: string): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (current: string, path: string[]): string[] | null => {
      if (recursionStack.has(current)) {
        // find the cycle and build the circular path
        const cycleStartIndex = path.indexOf(current);
        return path.slice(cycleStartIndex);
      }

      if (visited.has(current)) {
        return null;
      }

      visited.add(current);
      recursionStack.add(current);

      const node = this.dependencyGraph.get(current);
      if (node) {
        for (const dependency of node.dependencies) {
          const cycle = hasCycle(dependency, [...path, current]);
          if (cycle) {
            return cycle;
          }
        }
      }

      recursionStack.delete(current);
      return null;
    };

    return hasCycle(identifier, []);
  }

  /**
   * Build the circular path
   * 
   * @param circularNode - The node that forms the circular reference
   * @returns {string[]} The circular path
   */
  private buildCircularPath(circularNode: string): string[] {
    const index = this.resolutionStack.indexOf(circularNode);
    if (index === -1) {
      return [circularNode];
    }
    return [...this.resolutionStack.slice(index), circularNode];
  }

  /**
   * Get all circular dependencies
   * 
   * @returns {string[][]} An array of all circular dependencies
   */
  getAllCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();

    for (const [identifier] of this.dependencyGraph) {
      if (!visited.has(identifier)) {
        const cycle = this.detectCircularDependency(identifier);
        if (cycle) {
          cycles.push(cycle);
          // mark all nodes in the cycle as visited
          cycle.forEach(node => visited.add(node));
        }
      }
    }

    return cycles;
  }

  /**
   * Generate a dependency report
   * 
   * @returns {Object} A report object containing component statistics
   */
  generateDependencyReport(): {
    totalComponents: number;
    resolvedComponents: number;
    circularDependencies: string[][];
    unresolvedComponents: string[];
  } {
    const totalComponents = this.dependencyGraph.size;
    const resolvedComponents = Array.from(this.dependencyGraph.values())
      .filter(node => node.isResolved).length;
    const circularDependencies = this.getAllCircularDependencies();
    const unresolvedComponents = Array.from(this.dependencyGraph.values())
      .filter(node => !node.isResolved && !node.isResolving)
      .map(node => node.identifier);

    return {
      totalComponents,
      resolvedComponents,
      circularDependencies,
      unresolvedComponents
    };
  }

  /**
   * Get resolution suggestions for circular dependencies
   * 
   * @param circularPath - The circular path that forms the cycle
   * @returns {string[]} An array of resolution suggestions
   */
  getResolutionSuggestions(circularPath: string[]): string[] {
    const suggestions: string[] = [];

    if (circularPath.length > 0) {
      suggestions.push(`Use lazy loading in the following components (@Autowired({delay: true})):`);
      
      // suggest using lazy loading in some components in the cycle
      const middleIndex = Math.floor(circularPath.length / 2);
      suggestions.push(`  - ${circularPath[middleIndex]} (Recommended)`);
      
      if (circularPath.length > 2) {
        suggestions.push(`  - ${circularPath[circularPath.length - 2]} (Alternative)`);
      }

      suggestions.push(`Or refactor the code to eliminate the circular dependency:`);
      suggestions.push(`  - Extract common interfaces or abstract classes`);
      suggestions.push(`  - Use event-driven architecture`);
      suggestions.push(`  - Introduce mediator pattern`);
    }

    return suggestions;
  }

  /**
   * Clear the detector state
   */
  clear(): void {
    this.dependencyGraph.clear();
    this.resolutionStack = [];
    this.visitedInCurrentPath.clear();
    logger.Debug("Circular dependency detector has been cleared");
  }

  /**
   * Get the visualization string of the dependency graph
   */
  getDependencyGraphVisualization(): string {
    const lines: string[] = ['Dependency graph:'];
    
    for (const [identifier, node] of this.dependencyGraph) {
      const status = node.isResolved ? '✓' : node.isResolving ? '⌛' : '○';
      const deps = node.dependencies.length > 0 ? 
        ` -> [${node.dependencies.join(', ')}]` : ' (无依赖)';
      lines.push(`  ${status} ${identifier}${deps}`);
    }

    return lines.join('\n');
  }

  /**
   * Check if there are any circular dependencies
   */
  hasCircularDependencies(): boolean {
    return this.getAllCircularDependencies().length > 0;
  }

  /**
   * Get the transitive dependencies of a component
   * 
   * @param identifier - The unique identifier for the component
   * @returns {string[]} An array of transitive dependencies
   */
  getTransitiveDependencies(identifier: string): string[] {
    const visited = new Set<string>();
    const dependencies: string[] = [];

    const collectDeps = (current: string) => {
      if (visited.has(current)) {
        return;
      }
      visited.add(current);

      const node = this.dependencyGraph.get(current);
      if (node) {
        for (const dep of node.dependencies) {
          if (!dependencies.includes(dep)) {
            dependencies.push(dep);
          }
          collectDeps(dep);
        }
      }
    };

    collectDeps(identifier);
    return dependencies;
  }
} 