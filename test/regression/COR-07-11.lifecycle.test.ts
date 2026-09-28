import { Container, PostConstruct, PreDestroy } from '../../src';
import { EventEmitter } from 'events';

describe('COR-07/11 lifecycle', () => {
  test('deferred singleton constructs once; hooks await and disposal reverses registration', async () => {
    const container = new Container();
    container.setApp(new EventEmitter() as any);
    const events: string[] = [];
    let constructed = 0;
    class A {
      constructor() { constructed++; }
      @PostConstruct() async init() { await Promise.resolve(); events.push('initA'); (this as any).late = true; }
      @PreDestroy() async dispose() { events.push('destroyA'); }
    }
    class B { async init() { events.push('initB'); } async dispose() { events.push('destroyB'); } }
    container.reg('A', A, { isAsync: true });
    expect(constructed).toBe(0);
    expect(() => container.get('A')).toThrow(/not ready/);
    await container.ready();
    container.reg('B', B, { initMethod: 'init', destroyMethod: 'dispose' });
    await container.ready();
    expect(constructed).toBe(1);
    expect(Object.isSealed(container.get('A'))).toBe(false);
    container.seal();
    expect(Object.isSealed(container.get('A'))).toBe(true);
    await container.clear();
    await container.clear();
    expect(events).toEqual(['initA', 'initB', 'destroyB', 'destroyA']);
  });
  test('initialization failure rejects ready and still runs destruction', async () => {
    const container = new Container();
    const destroy = jest.fn();
    class Broken { async init() { throw new Error('init failed'); } dispose() { destroy(); } }
    container.reg('Broken', Broken, { initMethod: 'init', destroyMethod: 'dispose' });
    await expect(container.ready()).rejects.toThrow('init failed');
    await expect(container.clear()).rejects.toThrow('init failed');
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
