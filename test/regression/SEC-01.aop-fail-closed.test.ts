/**
 * SEC-01 regression tests: AOP aspects fail-closed (B-1 / ADR-101).
 *
 * Before/After/Around aspect errors must abort the business method by
 * default ('throw'), with an explicit per-aspect opt-out (`{ onError: 'log' }`)
 * and an application-profile override (`app.security.aop.onAspectError`).
 * After/AfterEach aspects receive the business result via `options.result`.
 *
 * NOTE: target classes are declared at module level — method decorators on
 * locally-defined class expressions do not fire under the current ts-jest
 * legacy-decorator emit.
 *
 * @ license: BSD (3-Clause)
 */
import { Container } from "../../src/container/container";
import { Aspect, Before, After, Around } from "../../src/decorator/aop";
import { IAspect } from "../../src/container/icontainer";
import { injectAOP } from "../../src/processor/aop_processor";

const IOC = Container.getInstance();

@Aspect()
class FailingAspect implements IAspect {
  app: any;
  async run(): Promise<any> {
    throw new Error("aspect boom");
  }
}

@Aspect()
class ResultProbeAspect implements IAspect {
  app: any;
  // pre-initialized so the singleton `Object.seal` still allows writes
  lastOptions: any = null;
  async run(args: any[], proceed?: Function, options?: any): Promise<any> {
    this.lastOptions = options;
  }
}

class Sec01Target {
  guardedCalls = 0;
  tolerantCalls = 0;
  aroundCalls = 0;

  @Before(FailingAspect)
  async guarded(): Promise<string> {
    this.guardedCalls++;
    return "business";
  }

  @Before(FailingAspect, { onError: "log" })
  async tolerant(): Promise<string> {
    this.tolerantCalls++;
    return "business";
  }

  @After(ResultProbeAspect)
  async withAfter(): Promise<string> {
    return "business-result";
  }

  @Around(FailingAspect)
  async arounded(): Promise<string> {
    this.aroundCalls++;
    return "business";
  }
}

class Sec01AfterTarget {
  @After(FailingAspect)
  async work(): Promise<string> {
    return "business";
  }
}

class Sec01ProfileTarget {
  calls = 0;
  @Before(FailingAspect)
  async work(): Promise<string> {
    this.calls++;
    return "business";
  }
}

describe("SEC-01: AOP aspect fail-closed", () => {
  beforeAll(() => {
    IOC.saveClass("COMPONENT", FailingAspect, "FailingAspect");
    IOC.saveClass("COMPONENT", ResultProbeAspect, "ResultProbeAspect");
    IOC.saveClass("COMPONENT", Sec01Target, "Sec01Target");
    IOC.saveClass("COMPONENT", Sec01AfterTarget, "Sec01AfterTarget");
    IOC.saveClass("COMPONENT", Sec01ProfileTarget, "Sec01ProfileTarget");
  });

  test("Before aspect error aborts the business method and propagates", async () => {
    const ins: Sec01Target = IOC.get("Sec01Target");
    await expect(ins.guarded()).rejects.toThrow("aspect boom");
    expect(ins.guardedCalls).toBe(0);
  });

  test("onError:'log' aspect keeps legacy behavior (business method runs)", async () => {
    const ins: Sec01Target = IOC.get("Sec01Target");
    await expect(ins.tolerant()).resolves.toBe("business");
    expect(ins.tolerantCalls).toBe(1);
  });

  test("After aspect error propagates (fail-closed)", async () => {
    const ins: Sec01AfterTarget = IOC.get("Sec01AfterTarget");
    await expect(ins.work()).rejects.toThrow("aspect boom");
  });

  test("Around aspect error does not fall through to the business method", async () => {
    const ins: Sec01Target = IOC.get("Sec01Target");
    await expect(ins.arounded()).rejects.toThrow("aspect boom");
    expect(ins.aroundCalls).toBe(0);
  });

  test("After aspect receives the business result via options.result", async () => {
    const ins: Sec01Target = IOC.get("Sec01Target");
    const res = await ins.withAfter();
    expect(res).toBe("business-result");
    const probe: ResultProbeAspect = IOC.get("ResultProbeAspect");
    expect(probe.lastOptions?.result).toBe("business-result");
    expect(probe.lastOptions?.targetMethod).toBe("withAfter");
  });

  test("profile override: app.security.aop.onAspectError controls the policy", async () => {
    const originalApp = (IOC as any).app;
    const ins: Sec01ProfileTarget = IOC.get("Sec01ProfileTarget");

    // default (no app): fail-closed
    await expect(ins.work()).rejects.toThrow("aspect boom");
    expect(ins.calls).toBe(0);

    // app profile selects the legacy 'log' policy: business method runs
    (IOC as any).app = { security: { aop: { onAspectError: "log" } } };
    try {
      await expect(ins.work()).resolves.toBe("business");
      expect(ins.calls).toBe(1);
    } finally {
      (IOC as any).app = originalApp;
    }
  });

  test("TC39 decorator mode: metadata attaches and fail-closed applies", async () => {
    class Sec01TC39Target {
      calls = 0;
      async m(): Promise<string> {
        this.calls++;
        return "business";
      }
    }
    let initializer: Function | null = null;
    const dec = (Before as any)(FailingAspect) as any;
    dec(Sec01TC39Target.prototype.m, {
      kind: "method",
      name: "m",
      static: false,
      private: false,
      access: {},
      addInitializer: (f: Function) => { initializer = f; },
    } as any);
    expect(typeof initializer).toBe("function");
    const inst = new Sec01TC39Target();
    initializer!.call(inst);
    injectAOP(Sec01TC39Target, IOC);
    await expect(inst.m()).rejects.toThrow("aspect boom");
    expect(inst.calls).toBe(0);
  });
});
