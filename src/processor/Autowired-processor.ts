/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-02-26 17:09:48
 * @LastEditTime: 2025-02-26 17:09:49
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { DefaultLogger as logger } from "koatty_logger";
import {
  IContainer, ObjectDefinitionOptions,
  TAGGED_PROP
} from "../container/IContainer";
import { recursiveGetMetadata } from "../utils/MetadataOpertor";
import { CircularDepError } from "../utils/CircularDepDetector";

/**
 * Inject autowired dependencies into the target class.
 * 
 * @param target The target class constructor function
 * @param prototypeChain The prototype chain object of the target class
 * @param container The IoC container instance
 * @param options Object definition options for dependency injection
 * @param isLazy Whether to use lazy loading for dependencies
 * 
 * @throws {Error} When a required dependency is not found and lazy loading is disabled
 * @throws {CircularDepError} When circular dependency is detected
 * 
 * @description
 * This function handles the injection of autowired dependencies by:
 * - Retrieving metadata for tagged properties
 * - Processing each dependency based on its type and identifier
 * - Supporting lazy loading to resolve circular dependencies
 * - Defining properties on the prototype chain for immediate injection
 * - Enhanced circular dependency detection and handling
 */
export function injectAutowired(target: Function, prototypeChain: object, container: IContainer,
  options?: ObjectDefinitionOptions, isLazy = false) {
  
  const metaData = recursiveGetMetadata(container, TAGGED_PROP, target);
  const className = target.name;
  const circularDetector = container.getCircularDependencyDetector();
  
  // collect all dependencies of the current class
  const currentDependencies: string[] = [];
  
  for (const metaKey in metaData) {
    const { type, identifier } =
      metaData[metaKey] || { type: "", identifier: "" };
    
    if (type && identifier) {
      currentDependencies.push(identifier);
      
      // add dependency relationship to the detector
      circularDetector.addDependency(className, identifier);
    }
  }
  
  // register current class and its dependencies to the detector
  circularDetector.registerComponent(className, className, currentDependencies);
  
  for (const metaKey in metaData) {
    const { type, identifier, delay, args } =
      metaData[metaKey] || { type: "", identifier: "", delay: false, args: [] };
    
    isLazy = isLazy || delay;
    
    if (type && identifier) {
      try {
        // detect circular dependency before injecting dependencies
        const circularPath = circularDetector.detectCircularDependency(identifier);
        if (circularPath && !isLazy && !options?.isAsync) {
          logger.Warn(`Circular dependency detected: ${circularPath.join(' -> ')}, enable lazy loading`);
          isLazy = true;
        }
        
        // Check if lazy loading is needed before attempting to get the dependency
        if (isLazy || options?.isAsync) {
          // Delay loading solves the problem of cyclic dependency
          logger.Debug(`Delay loading solves the problem of cyclic dependency(${identifier})`);
          
          // lazy loading used event emit
          if (options) {
            options.isAsync = true;
          }
          
          const app = container.getApp();
          // lazy inject autowired
          if (app?.once) {
            app.once("appReady", () => {
              try {
                logger.Debug(`Lazy loading triggered for ${className}.${metaKey} -> ${identifier}`);
                
                // Get the dependency now
                const dep = container.get(identifier, type, ...args);
                
                if (!dep) {
                  logger.Error(`Lazy loading failed: Component ${identifier} not found for ${className}.${metaKey}`);
                  return;
                }
                
                // Get the actual instance of the target class
                const instance = container.getInsByClass(target);
                if (!instance) {
                  logger.Error(`Lazy loading failed: Instance of ${className} not found`);
                  return;
                }
                
                // Inject the dependency into the instance
                logger.Debug(`Injecting ${identifier} into ${className}.${metaKey}`);
                Object.defineProperty(instance, metaKey, {
                  enumerable: true,
                  configurable: false,
                  writable: true,
                  value: dep
                });
                
                logger.Debug(`Lazy injection successful: ${className}.${metaKey} = ${dep.constructor.name}`);
                
              } catch (lazyError) {
                if (lazyError instanceof CircularDepError) {
                  logger.Error(`Circular dependency still exists when injecting lazily: ${className}.${metaKey}:`, lazyError.getDetailedMessage());
                  
                  // provide resolution suggestions
                  const suggestions = circularDetector.getResolutionSuggestions(lazyError.circularPath);
                  logger.Info("Suggested solutions:");
                  suggestions.forEach((suggestion: string) => logger.Info(suggestion));
                  
                  // try using null as a fallback
                  logger.Warn(`Use null as a fallback for ${className}.${metaKey}`);
                  const instance = container.getInsByClass(target);
                  if (instance) {
                    Object.defineProperty(instance, metaKey, {
                      enumerable: true,
                      configurable: false,
                      writable: true,
                      value: null
                    });
                  }
                } else {
                  logger.Error(`Lazy injection failed: ${className}.${metaKey}:`, lazyError);
                }
              }
            });
          }
          continue; // Skip immediate injection for lazy dependencies
        }
        
        // Only get the dependency if not lazy loading
        const dep = container.get(identifier, type, ...args);
        
        if (!dep) {
          throw new Error(
            `Component ${metaData[metaKey].identifier ?? ""} not found. It's inject in class ${target.name}`);
        }

        logger.Debug(
          `Register inject ${target.name} properties key: ${metaKey} => value: ${JSON.stringify(metaData[metaKey])}`);
        
        // validate if the dependency is valid
        if (dep === null || dep === undefined) {
          throw new Error(`Dependency ${identifier} is null or undefined for ${className}.${metaKey}`);
        }
        
        Reflect.defineProperty(prototypeChain, metaKey, {
          enumerable: true,
          configurable: false,
          writable: true,
          value: dep
        });
      } catch (error) {
        if (error instanceof CircularDepError) {
          logger.Error(`Circular dependency error in ${className}.${metaKey}:`, error.getDetailedMessage());
          
          // if not lazy loading, try to enable lazy loading
          if (!isLazy && !options?.isAsync) {
            logger.Info(`Enable lazy loading for ${className}.${metaKey} to solve circular dependency`);
            isLazy = true;
            
            if (options) {
              options.isAsync = true;
            }
            
            const app = container.getApp();
            if (app?.once) {
              app.once("appReady", () => {
                try {
                  logger.Debug(`Retry lazy loading for ${className}.${metaKey} -> ${identifier}`);
                  
                  const dep = container.get(identifier, type, ...args);
                  const instance = container.getInsByClass(target);
                  
                  if (dep && instance) {
                    Object.defineProperty(instance, metaKey, {
                      enumerable: true,
                      configurable: false,
                      writable: true,
                      value: dep
                    });
                    logger.Debug(`Retry lazy injection successful: ${className}.${metaKey}`);
                  }
                } catch (retryError) {
                  logger.Error(`Lazy loading retry failed: ${className}.${metaKey}:`, retryError);
                }
              });
            }
            continue;
          }
          
          throw error;
        }
        
        // other errors
        logger.Error(`Injection failed: ${className}.${metaKey}:`, error);
        throw new Error(`Failed to inject dependency ${identifier} in ${className}.${metaKey}: ${error.message}`);
      }
    } else {
      logger.Warn(`Invalid dependency metadata: ${className}.${metaKey}:`, metaData[metaKey]);
    }
  }
  
  logger.Debug(`Dependency injection completed: ${className}, total dependencies: ${currentDependencies.length}`);
}
