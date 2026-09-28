/**
 * ARCH-01 / D-1 regression tests: container multi-instance isolation.
 *
 * `new Container()` must own its class
 * registry, instance table and metadata cache, so two applications in one
 * process no longer share singletons. The global `Container.getInstance()`
 * remains the default container and keeps the shared metadata cache.
 *
 * @ license: BSD (3-Clause)
 */
import { Container } from "../../src/container/container";

describe("ARCH-01: container multi-instance isolation", () => {
  test("two isolated containers return distinct singleton instances", () => {
    class ScopedBean {
      id = Math.random();
    }

    const a = new Container();
    const b = new Container();

    a.saveClass("COMPONENT", ScopedBean, ScopedBean.name);
    b.saveClass("COMPONENT", ScopedBean, ScopedBean.name);

    const fromA = a.get<any>(ScopedBean.name, "COMPONENT");
    const fromB = b.get<any>(ScopedBean.name, "COMPONENT");

    expect(fromA).toBeDefined();
    expect(fromB).toBeDefined();
    // Same class, different containers -> different singleton instances.
    expect(fromA).not.toBe(fromB);
    expect(fromA.id).not.toBe(fromB.id);
  });

  test("a class registered in one container is not visible in another", () => {
    class PrivateBean {}

    const a = new Container();
    const b = new Container();

    a.saveClass("COMPONENT", PrivateBean, PrivateBean.name);
    expect(a.getClass(PrivateBean.name, "COMPONENT")).toBeDefined();
    expect(b.getClass(PrivateBean.name, "COMPONENT")).toBeUndefined();
    expect(() => b.get(PrivateBean.name, "COMPONENT")).toThrow(/not found/);
  });

  test("each isolated container owns a different metadata cache", () => {
    const a = new Container();
    const b = new Container();
    const shared = Container.getInstance();

    expect(a.getMetadataCache()).not.toBe(b.getMetadataCache());
    // The default container keeps the process-wide shared cache.
    expect(shared.getMetadataCache()).toBe(Container.getInstance().getMetadataCache());
  });

  test("isolated containers do not require manual cleanup between them", () => {
    class StatefulBean {
      value = 0;
      bump() {
        return ++this.value;
      }
    }

    const a = new Container();
    const b = new Container();
    a.saveClass("COMPONENT", StatefulBean, StatefulBean.name);
    b.saveClass("COMPONENT", StatefulBean, StatefulBean.name);

    const svcA = a.get<any>(StatefulBean.name, "COMPONENT");
    svcA.bump();
    svcA.bump();
    expect(svcA.value).toBe(2);

    // B is untouched by A's mutations.
    const svcB = b.get<any>(StatefulBean.name, "COMPONENT");
    expect(svcB.value).toBe(0);
  });

  test("getInstance still returns a stable default container", () => {
    expect(Container.getInstance()).toBe(Container.getInstance());
  });
});
