import { Container, IOC } from '../../src/container/container';
import { Autowired } from '../../src/decorator/autowired';
import { Before, Around } from '../../src/decorator/aop';

class PerAppDependency { value = ''; }
class PerAppConsumer { @Autowired(PerAppDependency) dependency: PerAppDependency; }
class PerCallDependency {}
class PerCallConsumer { @Autowired(PerCallDependency) dependency: PerCallDependency; }
class AsyncBeforeTarget {
  order: string[] = [];
  async __before() { await Promise.resolve(); this.order.push('before'); }
  work() { this.order.push('work'); return 7; }
}
class TwiceAspect { run(args: any[], proceed: Function) { proceed(); return proceed(); } }
class OnceTarget { calls = 0; @Around(TwiceAspect) work() { return ++this.calls; } }
class SyncBeforeAspect { run() { return undefined; } }
class PlainTarget { @Before(SyncBeforeAspect) work() { return 8; } }

test('independent containers inject their own dependency into the same class', async () => {
  const a = new Container(), b = new Container();
  for (const c of [a,b]) { c.reg(PerAppDependency); c.reg(PerAppConsumer); }
  a.get<PerAppDependency>('PerAppDependency').value = 'a';
  b.get<PerAppDependency>('PerAppDependency').value = 'b';
  expect(a.get<PerAppConsumer>('PerAppConsumer').dependency.value).toBe('a');
  expect(b.get<PerAppConsumer>('PerAppConsumer').dependency.value).toBe('b');
  expect(Object.hasOwn(PerAppConsumer.prototype, 'dependency')).toBe(false);
  await Promise.all([a.clear(), b.clear()]);
});
test('prototype dependencies belong to each instance', async () => {
  const c = new Container();
  c.reg(PerCallDependency, {scope: 'Prototype'}); c.reg(PerCallConsumer, {scope: 'Prototype'});
  expect(c.get<PerCallConsumer>('PerCallConsumer').dependency).not.toBe(c.get<PerCallConsumer>('PerCallConsumer').dependency);
  await c.clear();
});
test('request scope survives concurrent await and rejects outside request', async () => {
  class Scoped {}
  const c = new Container(); c.reg(Scoped, {scope:'Request'});
  const results = await Promise.all([{},{}].map(ctx => c.runInRequestScope(ctx, async () => {
    const first = c.get('Scoped'); await Promise.resolve();
    expect(c.get('Scoped')).toBe(first); return first;
  })));
  expect(results[0]).not.toBe(results[1]); expect(() => c.get('Scoped')).toThrow(/active request/);
  await c.clear();
});
test('AOP waits for asynchronous builtin before and retains sync run results', async () => {
  const c = new Container(); c.reg(AsyncBeforeTarget); c.reg(SyncBeforeAspect); c.reg(PlainTarget);
  const t = c.get<AsyncBeforeTarget>('AsyncBeforeTarget');
  expect(await t.work()).toBe(7); expect(t.order).toEqual(['before','work']);
  expect(c.get<PlainTarget>('PlainTarget').work()).toBe(8); await c.clear();
});
test('Around proceed invokes the business at most once', async () => {
  const c = new Container(); c.reg(TwiceAspect); c.reg(OnceTarget);
  const t = c.get<OnceTarget>('OnceTarget'); expect(t.work()).toBe(1); expect(t.calls).toBe(1); await c.clear();
});

test('request and prototype hooks initialize and dispose each actual request instance', async () => {
  const events: string[] = [];
  class ScopedLifecycle { async init() { events.push('init'); } dispose() { events.push('dispose'); } }
  for (const scope of ['Request', 'Prototype'] as const) {
    const c = new Container();
    c.reg(ScopedLifecycle, {scope, initMethod:'init', destroyMethod:'dispose'});
    expect(events).toEqual([]);
    const ctx = {};
    await c.runInRequestScope(ctx, async () => {
      const instance = c.get('ScopedLifecycle');
      expect(instance).toBeDefined(); await c.readyRequestScope(ctx);
      expect(events).toEqual(['init']);
    });
    await c.releaseRequestScope(ctx); await c.releaseRequestScope(ctx);
    expect(events).toEqual(['init','dispose']); events.length = 0; await c.clear();
  }
});

test('metadata caches distinguish different constructors with identical names', async () => {
  const A = class SameName {}, B = class SameName {};
  const c = new Container();
  c.savePropertyData('example', 'a', A, 'value'); c.savePropertyData('example', 'b', B, 'value');
  expect(c.getPropertyData('example', A, 'value')).toBe('a');
  expect(c.getPropertyData('example', B.prototype, 'value')).toBe('b');
  c.attachClassMetadata('meta', 'items', 'one', A); c.attachClassMetadata('meta', 'items', 'two', A);
  expect(c.getClassMetadata('meta','items',A)).toEqual(['one','two']); await c.clear();
});

test('registering the same class under different app identifiers does not overwrite its identity', async () => {
  class Shared {}
  const a = new Container(), b = new Container();
  a.reg('First', Shared); b.reg('Second', Shared);
  expect(a.getIdentifier(Shared)).toBe('First'); expect(b.getIdentifier(Shared)).toBe('Second');
  expect(a.getInsByClass(Shared)).toBe(a.get('First'));
  expect(b.getInsByClass(Shared)).toBe(b.get('Second'));
  expect(a.get('First')).not.toBe(b.get('Second'));
  await Promise.all([a.clear(),b.clear()]);
});
