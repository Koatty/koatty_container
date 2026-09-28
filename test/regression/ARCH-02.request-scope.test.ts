/**
 * ARCH-02 / D-2 regression tests: request scope and instance-level injection.
 *
 * Request-scoped beans are cached per request context (WeakMap keyed by ctx),
 * so two distinct contexts get two distinct instances while repeated lookups
 * inside one context return the same instance. Outside a request scope the
 * container must not hand out a per-request instance.
 *
 * @ license: BSD (3-Clause)
 */
import { Container } from '../../src/container/container';

/** Mark a class as Request-scoped (what `@Component({ scope: 'Request' })` does). */
function asRequestScoped<T extends Function>(cls: T): T {
  Reflect.defineProperty(cls.prototype, '_options', {
    value: { scope: 'Request' },
    configurable: true,
  });
  return cls;
}

describe('ARCH-02: request-scoped beans', () => {
  test('distinct request contexts receive distinct instances', () => {
    class RequestScopedBean {
      id = Math.random();
    }
    asRequestScoped(RequestScopedBean);

    const c = new Container();
    c.saveClass('COMPONENT', RequestScopedBean, RequestScopedBean.name);

    const ctxA = {};
    const ctxB = {};

    const a1 = c.runInRequestScope(ctxA, () => c.get<any>(RequestScopedBean.name, 'COMPONENT'));
    const a2 = c.runInRequestScope(ctxA, () => c.get<any>(RequestScopedBean.name, 'COMPONENT'));
    const b1 = c.runInRequestScope(ctxB, () => c.get<any>(RequestScopedBean.name, 'COMPONENT'));

    // Same request -> same instance; different request -> different instance.
    expect(a1).toBe(a2);
    expect(b1).not.toBe(a1);
    expect(b1.id).not.toBe(a1.id);
  });

  test('request scope does not leak state across requests', () => {
    class NoLeakBean {
      value = 0;
    }
    asRequestScoped(NoLeakBean);

    const c = new Container();
    c.saveClass('COMPONENT', NoLeakBean, NoLeakBean.name);

    const ctx1 = {};
    const first = c.runInRequestScope(ctx1, () => c.get<any>(NoLeakBean.name, 'COMPONENT'));
    first.value = 99;

    const ctx2 = {};
    const second = c.runInRequestScope(ctx2, () => c.get<any>(NoLeakBean.name, 'COMPONENT'));
    expect(second.value).toBe(0);
  });

  test('nested scopes restore the outer binding on exit', () => {
    class NestedBean {}
    asRequestScoped(NestedBean);

    const c = new Container();
    c.saveClass('COMPONENT', NestedBean, NestedBean.name);

    const outer = {};
    const inner = {};
    let outerInstance: any;

    c.runInRequestScope(outer, () => {
      outerInstance = c.get<any>(NestedBean.name, 'COMPONENT');
      const innerInstance = c.runInRequestScope(inner, () => c.get<any>(NestedBean.name, 'COMPONENT'));
      expect(innerInstance).not.toBe(outerInstance);
    });

    // Back in the outer scope, the outer instance is the active one again.
    const again = c.runInRequestScope(outer, () => c.get<any>(NestedBean.name, 'COMPONENT'));
    expect(again).toBe(outerInstance);
  });

  test('a Singleton depending on a Request-scoped bean fails at registration', () => {
    class RequestScopedDep {}
    asRequestScoped(RequestScopedDep);

    class SingletonConsumer {}

    const c = new Container();
    c.reg(RequestScopedDep.name, RequestScopedDep, { scope: 'Request', type: 'COMPONENT' } as any);
    c.saveClass('COMPONENT', SingletonConsumer, SingletonConsumer.name);

    // Mirror the registration-time check with the declared dependency list.
    expect(() => (c as any).checkNoRequestScopeDependency(SingletonConsumer.name, [RequestScopedDep.name]))
      .toThrow(/cannot depend on Request-scoped/);
    // The message must point users at the lazy-proxy escape hatch.
    expect(() => (c as any).checkNoRequestScopeDependency(SingletonConsumer.name, [RequestScopedDep.name]))
      .toThrow(/Request-scoped consumer/);
  });

  test('Singleton scope is unaffected by request scoping', () => {
    class SingletonBean {
      id = Math.random();
    }

    const c = new Container();
    c.saveClass('COMPONENT', SingletonBean, SingletonBean.name);

    const ctxA = {};
    const ctxB = {};
    const a = c.runInRequestScope(ctxA, () => c.get<any>(SingletonBean.name, 'COMPONENT'));
    const b = c.runInRequestScope(ctxB, () => c.get<any>(SingletonBean.name, 'COMPONENT'));
    expect(a).toBe(b);
  });
});
