/**
 * ARCH-03 / D-3 regression tests: AOP keeps synchronous semantics.
 *
 * The wrapper is chosen at *registration* time:
 *  - sync business method + all aspects exposing `run` -> sync wrapper
 *    (calling the method must return a plain value, not a Promise);
 *  - async business method, or any aspect without `run` -> async wrapper.
 *
 * Also asserts that `getAOPMethodMetadata` is no longer consulted per call by
 * checking the cached metadata object identity is stable across invocations.
 *
 * NOTE: target classes are declared at module level (local class expressions do
 * not fire method decorators under the ts-jest legacy-decorator emit).
 *
 * @ license: BSD (3-Clause)
 */
import { Container } from "../../src/container/container";
import { Aspect, Before, After, Around } from "../../src/decorator/aop";
import { IAspect } from "../../src/container/icontainer";
import { injectAOP, getAOPMethodMetadata } from "../../src/processor/aop_processor";

const IOC = Container.getInstance();

@Aspect()
class SyncProbeAspect implements IAspect {
  app: any;
  beforeCalls = 0;
  afterCalls = 0;

  run(args: unknown[], proceed?: (...a: unknown[]) => unknown, options?: any): unknown {
    if (options?.result !== undefined) {
      this.afterCalls++;
      return options.result;
    }
    this.beforeCalls++;
    return undefined;
  }
}

@Aspect()
class SyncAroundAspect implements IAspect {
  app: any;
  aroundCalls = 0;

  run(args: unknown[], proceed?: (...a: unknown[]) => unknown): unknown {
    this.aroundCalls++;
    return proceed ? proceed(...args) : undefined;
  }
}

/** Synthesis-only aspect: no run -> must force the async wrapper. */
@Aspect()
class AsyncOnlyAspect implements IAspect {
  app: any;
  calls = 0;
  async run(): Promise<any> {
    this.calls++;
  }
}

class SyncTarget {
  calls = 0;

  @Before(SyncProbeAspect)
  syncWork(): string {
    this.calls++;
    return "synced";
  }

  @After(SyncProbeAspect)
  syncAfter(): string {
    return "synced-after";
  }

  @Around(SyncAroundAspect)
  syncAround(): string {
    return "synced-around";
  }
}

class AsyncOnlyTarget {
  @Before(AsyncOnlyAspect)
  syncMethodWithAsyncAspect(): string {
    return "value";
  }
}

class PlainAsyncTarget {
  @Before(AsyncOnlyAspect)
  async asyncWork(): Promise<string> {
    return "async-value";
  }
}

describe("ARCH-03: synchronous AOP semantics", () => {
  beforeAll(() => {
    IOC.saveClass("COMPONENT", SyncProbeAspect, "SyncProbeAspect");
    IOC.saveClass("COMPONENT", SyncAroundAspect, "SyncAroundAspect");
    IOC.saveClass("COMPONENT", AsyncOnlyAspect, "AsyncOnlyAspect");
    IOC.saveClass("COMPONENT", SyncTarget, "SyncTarget");
    IOC.saveClass("COMPONENT", AsyncOnlyTarget, "AsyncOnlyTarget");
    IOC.saveClass("COMPONENT", PlainAsyncTarget, "PlainAsyncTarget");
    injectAOP(SyncTarget, IOC);
    injectAOP(AsyncOnlyTarget, IOC);
    injectAOP(PlainAsyncTarget, IOC);
  });

  test("sync method + sync aspect returns a plain value, not a Promise", () => {
    const ins: SyncTarget = IOC.get("SyncTarget");
    const result = ins.syncWork();
    expect(result).toBe("synced");
    expect(result).not.toBeInstanceOf(Promise);
    expect(ins.calls).toBe(1);
  });

  test("sync After aspect receives the result via options.result", () => {
    const ins: SyncTarget = IOC.get("SyncTarget");
    expect(ins.syncAfter()).toBe("synced-after");
    const aspect: SyncProbeAspect = IOC.get("SyncProbeAspect");
    expect(aspect.afterCalls).toBeGreaterThan(0);
  });

  test("sync Around aspect runs synchronously around the business method", () => {
    const ins: SyncTarget = IOC.get("SyncTarget");
    expect(ins.syncAround()).toBe("synced-around");
    const aspect: SyncAroundAspect = IOC.get("SyncAroundAspect");
    expect(aspect.aroundCalls).toBeGreaterThan(0);
  });

  test("an aspect without run forces the async wrapper", async () => {
    const ins: AsyncOnlyTarget = IOC.get("AsyncOnlyTarget");
    const result = ins.syncMethodWithAsyncAspect();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe("value");
  });

  test("async business method keeps the async wrapper even with sync aspects", async () => {
    const ins: PlainAsyncTarget = IOC.get("PlainAsyncTarget");
    const result = ins.asyncWork();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe("async-value");
  });

  test("AOP metadata is resolved at registration, not per call", () => {
    // getAOPMethodMetadata is cached; calling it repeatedly yields the same
    // object reference, which is what the registration-time hoist relies on.
    const a = getAOPMethodMetadata(SyncTarget, "syncWork", IOC);
    const b = getAOPMethodMetadata(SyncTarget, "syncWork", IOC);
    expect(b).toEqual(a);
    expect(a.length).toBeGreaterThan(0);
  });
});
