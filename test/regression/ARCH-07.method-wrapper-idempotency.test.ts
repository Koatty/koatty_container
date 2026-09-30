/**
 * ARCH-07: method wrapper registration must stay idempotent and bounded.
 *
 * Re-registering decorators onto an already-wrapped method (clearCaches,
 * repeated decoration, decorator stacking) used to nest a new wrapper around
 * the previous product each time; with the wrapper cache involved a re-entered
 * chain could recurse without bound (RangeError on CI). The registry now
 * resolves any wrapper product back to its single wrapper and recompiles one
 * bounded chain, and cache keys are scoped per owning class.
 */
import { decoratorManager } from '../../src/manager/index';
import type { DecoratorMetadata } from '../../src/manager/index';

describe('ARCH-07: method decorator wrapper idempotency', () => {
  beforeEach(() => decoratorManager.clearAllCaches());

  test('re-registering the same descriptor many times keeps one bounded chain', () => {
    const calls: string[] = [];
    decoratorManager.method.registerWrapper('counting', (original, _config, name) =>
      function (this: any, ...args: any[]) {
        calls.push(name);
        return original.apply(this, args);
      }
    );

    const wrap = (type: string, priority: number) => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const metadata: DecoratorMetadata = { type, config: {}, applied: false, priority };
      return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
    };

    class Service {
      @wrap('counting', 5)
      public value(): number {
        return 1;
      }
    }

    const service = new Service();
    // The legacy decorator protocol hands each decorator the current
    // descriptor; replay deep-stack registration the way runtime reload and
    // cache clears can, and assert the chain cannot grow without bound.
    let descriptor: PropertyDescriptor = Object.getOwnPropertyDescriptor(Service.prototype, 'value')!;
    for (let i = 0; i < 2000; i++) {
      const type = i % 2 === 0 ? 'counting' : 'counting2';
      if (type === 'counting2') decoratorManager.method.registerWrapper('counting2', (original, _c, name) =>
        function (this: any, ...args: any[]) {
          calls.push(name);
          return original.apply(this, args);
        }
      );
      const metadata: DecoratorMetadata = { type, config: {}, applied: false, priority: i % 2 };
      descriptor = decoratorManager.method.registerDecorator(Service.prototype, 'value', metadata, descriptor);
      Object.defineProperty(Service.prototype, 'value', descriptor);
    }

    expect(service.value()).toBe(1);
    // Two distinct decorator types: the original plus one execution per type.
    expect(calls.filter(c => c === 'value').length).toBe(2);
  });

  test('same-named methods on different classes do not share compiled wrappers', () => {
    decoratorManager.method.registerWrapper('pass', original =>
      function (this: any) {
        return original.apply(this);
      }
    );

    const Tagged = () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const metadata: DecoratorMetadata = { type: 'pass', config: {}, applied: false, priority: 1 };
      return decoratorManager.method.registerDecorator(target, propertyKey, metadata, descriptor);
    };

    class A {
      @Tagged()
      public who(): string {
        return 'A';
      }
    }
    class B {
      @Tagged()
      public who(): string {
        return 'B';
      }
    }

    expect(new A().who()).toBe('A');
    expect(new B().who()).toBe('B');
  });
});
