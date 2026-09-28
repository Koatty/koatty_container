/** Method metadata lives on functions, so it works with both decorator emit modes. */
export const POST_CONSTRUCT = Symbol.for('koatty.PostConstruct');
export const PRE_DESTROY = Symbol.for('koatty.PreDestroy');
function hook(tag: symbol): any {
  return (target: any, keyOrContext: any, descriptor?: PropertyDescriptor) => {
    const method = descriptor?.value ?? target;
    if (typeof method !== 'function') throw new Error('Lifecycle decorators require a method');
    Object.defineProperty(method, tag, { value: true });
    return descriptor ?? method;
  };
}
export function PostConstruct(): any { return hook(POST_CONSTRUCT); }
export function PreDestroy(): any { return hook(PRE_DESTROY); }
