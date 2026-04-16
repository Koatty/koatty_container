/**
 * Decorator compatibility layer for legacy and TC39 decorator support.
 * Detects decorator calling convention at runtime and routes accordingly.
 */

/**
 * Check if the second argument is a TC39 decorator context object.
 * TC39 context has { kind, name, metadata, addInitializer } shape.
 */
export function isTC39Context(context: any): boolean {
  return context != null
    && typeof context === 'object'
    && 'kind' in context
    && typeof context.kind === 'string';
}

/**
 * Create a class decorator that works with both legacy and TC39 signatures.
 *
 * Legacy: (target: Function) => void
 * TC39:   (target: Function, context: ClassDecoratorContext) => Function | void
 *
 * @param handler - receives (target, context?) and performs the actual decoration logic.
 *   The handler always receives the class constructor as `target`.
 *   `context` is the TC39 ClassDecoratorContext if present, or undefined in legacy mode.
 */
export function createDualClassDecorator(
  handler: (target: Function, context?: any) => Function | void
): (target: any, context?: any) => any {
  return (target: any, context?: any) => {
    if (isTC39Context(context)) {
      // TC39 path: target is the class, context is ClassDecoratorContext
      return handler(target, context);
    } else {
      // Legacy path: target is the class, no context
      return handler(target);
    }
  };
}

/**
 * Create a method decorator that works with both legacy and TC39 signatures.
 *
 * Legacy: (target: object, propertyKey: string|symbol, descriptor: PropertyDescriptor) => void
 * TC39:   (method: Function, context: ClassMethodDecoratorContext) => Function | void
 *
 * @param handler - receives normalized arguments:
 *   - target: class prototype (legacy) or undefined (TC39)
 *   - methodName: string name of the method
 *   - descriptor: PropertyDescriptor (legacy) or undefined (TC39)
 *   - method: the original method function (TC39) or undefined (legacy)
 *   - context: TC39 ClassMethodDecoratorContext or undefined (legacy)
 */
export function createDualMethodDecorator(
  handler: (args: {
    target?: object;
    methodName: string;
    descriptor?: PropertyDescriptor;
    method?: Function;
    context?: any;
  }) => any
): (...args: any[]) => any {
  return (...args: any[]) => {
    if (args.length === 2 && isTC39Context(args[1])) {
      // TC39: (method, context)
      const [method, context] = args;
      return handler({
        methodName: String(context.name),
        method,
        context
      });
    } else {
      // Legacy: (target, key, descriptor)
      const [target, key, descriptor] = args;
      return handler({
        target,
        methodName: String(key),
        descriptor
      });
    }
  };
}

/**
 * Create a field/property decorator that works with both legacy and TC39 signatures.
 *
 * Legacy: (target: object, propertyKey: string|symbol) => void
 * TC39:   (value: undefined, context: ClassFieldDecoratorContext) => ((initialValue) => any) | void
 *
 * @param legacyHandler - handles legacy decoration: (target, propertyKey) => void
 * @param tc39Handler - handles TC39 decoration: (context) => ((initialValue) => any) | void
 */
export function createDualFieldDecorator(
  legacyHandler: (target: object, propertyKey: string | symbol) => void,
  tc39Handler: (context: any) => ((initialValue: any) => any) | void
): (...args: any[]) => any {
  return (...args: any[]) => {
    if (args.length === 2 && isTC39Context(args[1])) {
      // TC39: (undefined, context)
      return tc39Handler(args[1]);
    } else {
      // Legacy: (target, propertyKey)
      return legacyHandler(args[0], args[1]);
    }
  };
}
