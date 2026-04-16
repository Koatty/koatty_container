/**
 * Tests for the decorator compatibility layer (compat.ts).
 * Verifies that isTC39Context and IOC.createDecorator work correctly
 * in both legacy and TC39 calling conventions.
 */

import { isTC39Context } from "../src/decorator/compat";
import { IOC } from "../src/container/container";

// ─── isTC39Context ────────────────────────────────────────────────────────────

describe("isTC39Context", () => {
  test("returns true for a valid TC39 context object", () => {
    const ctx = { kind: "class", name: "MyClass", metadata: {} };
    expect(isTC39Context(ctx)).toBe(true);
  });

  test("returns true for TC39 method context", () => {
    const ctx = { kind: "method", name: "myMethod", metadata: {} };
    expect(isTC39Context(ctx)).toBe(true);
  });

  test("returns true for TC39 field context", () => {
    const ctx = { kind: "field", name: "myField", metadata: {} };
    expect(isTC39Context(ctx)).toBe(true);
  });

  test("returns false for null", () => {
    expect(isTC39Context(null)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isTC39Context(undefined)).toBe(false);
  });

  test("returns false for a string", () => {
    expect(isTC39Context("class")).toBe(false);
  });

  test("returns false for a number", () => {
    expect(isTC39Context(42)).toBe(false);
  });

  test("returns false for an empty object", () => {
    expect(isTC39Context({})).toBe(false);
  });

  test("returns false for an object without kind", () => {
    expect(isTC39Context({ name: "MyClass", metadata: {} })).toBe(false);
  });

  test("returns false when kind is not a string", () => {
    expect(isTC39Context({ kind: 123 })).toBe(false);
  });

  test("returns false for PropertyDescriptor (legacy arg)", () => {
    const descriptor: PropertyDescriptor = {
      value: () => {},
      writable: true,
      enumerable: true,
      configurable: true,
    };
    expect(isTC39Context(descriptor)).toBe(false);
  });
});

// ─── IOC.createDecorator('class') ──────────────────────────────────────────────

describe("IOC.createDecorator('class')", () => {
  test("legacy mode: handler receives (target) with no context", () => {
    const received: any[] = [];
    const decorator = IOC.createDecorator((target, context?) => {
      received.push({ target, context });
    }, 'class');

    class MyClass {}
    decorator(MyClass);

    expect(received).toHaveLength(1);
    expect(received[0].target).toBe(MyClass);
    expect(received[0].context).toBeUndefined();
  });

  test("TC39 mode: handler receives (target, context)", () => {
    const received: any[] = [];
    const decorator = IOC.createDecorator((target, context?) => {
      received.push({ target, context });
    }, 'class');

    class MyClass {}
    const tc39Context = { kind: "class", name: "MyClass", metadata: {} };
    decorator(MyClass, tc39Context);

    expect(received).toHaveLength(1);
    expect(received[0].target).toBe(MyClass);
    expect(received[0].context).toBe(tc39Context);
  });

  test("legacy mode: handler return value is forwarded", () => {
    const replacement = function Replacement() {};
    const decorator = IOC.createDecorator((_target) => {
      return replacement;
    }, 'class');

    class MyClass {}
    const result = decorator(MyClass);
    expect(result).toBe(replacement);
  });

  test("TC39 mode: handler return value is forwarded", () => {
    const replacement = function Replacement() {};
    const decorator = IOC.createDecorator((_target, _context?) => {
      return replacement;
    }, 'class');

    class MyClass {}
    const tc39Context = { kind: "class", name: "MyClass", metadata: {} };
    const result = decorator(MyClass, tc39Context);
    expect(result).toBe(replacement);
  });

  test("legacy mode: handler can return void (undefined)", () => {
    const decorator = IOC.createDecorator((_target) => {
      // no return
    }, 'class');

    class MyClass {}
    const result = decorator(MyClass);
    expect(result).toBeUndefined();
  });

  test("works with closures capturing outer arguments (simulating @Aspect pattern)", () => {
    const savedIdentifier = "MyCustomIdentifier";
    const decorator = IOC.createDecorator((target) => {
      // simulate saving with identifier
      (target as any).__savedIdentifier = savedIdentifier;
    }, 'class');

    class TestClass {}
    decorator(TestClass);
    expect((TestClass as any).__savedIdentifier).toBe("MyCustomIdentifier");
  });
});

// ─── IOC.createDecorator('method') ───────────────────────────────────────────

describe("IOC.createDecorator('method')", () => {
  test("legacy mode: handler receives (target, methodName, descriptor)", () => {
    const received: any[] = [];
    const decorator = IOC.createDecorator((args) => {
      received.push(args);
    }, 'method');

    const target = {};
    const descriptor: PropertyDescriptor = {
      value: function () {},
      writable: true,
    };
    decorator(target, "myMethod", descriptor);

    expect(received).toHaveLength(1);
    expect(received[0].target).toBe(target);
    expect(received[0].methodName).toBe("myMethod");
    expect(received[0].descriptor).toBe(descriptor);
    expect(received[0].method).toBeUndefined();
    expect(received[0].context).toBeUndefined();
  });

  test("TC39 mode: handler receives (method, context)", () => {
    const received: any[] = [];
    const decorator = IOC.createDecorator((args) => {
      received.push(args);
    }, 'method');

    const originalMethod = function () {};
    const tc39Context = { kind: "method", name: "myMethod", metadata: {} };
    decorator(originalMethod, tc39Context);

    expect(received).toHaveLength(1);
    expect(received[0].target).toBeUndefined();
    expect(received[0].methodName).toBe("myMethod");
    expect(received[0].descriptor).toBeUndefined();
    expect(received[0].method).toBe(originalMethod);
    expect(received[0].context).toBe(tc39Context);
  });

  test("legacy mode: handler return value is forwarded", () => {
    const replacementDescriptor: PropertyDescriptor = {
      value: function () { return "replaced"; },
      writable: true,
    };
    const decorator = IOC.createDecorator((_args) => {
      return replacementDescriptor;
    }, 'method');

    const result = decorator({}, "myMethod", { value: () => {}, writable: true });
    expect(result).toBe(replacementDescriptor);
  });

  test("TC39 mode: handler return value is forwarded", () => {
    const replacementFn = function () { return "replaced"; };
    const decorator = IOC.createDecorator((_args) => {
      return replacementFn;
    }, 'method');

    const tc39Context = { kind: "method", name: "myMethod", metadata: {} };
    const result = decorator(function () {}, tc39Context);
    expect(result).toBe(replacementFn);
  });

  test("TC39 mode: symbol name is converted to string", () => {
    const received: any[] = [];
    const decorator = IOC.createDecorator((args) => {
      received.push(args);
    }, 'method');

    const sym = Symbol("myMethod");
    const tc39Context = { kind: "method", name: sym, metadata: {} };
    decorator(function () {}, tc39Context);

    expect(received[0].methodName).toBe("Symbol(myMethod)");
  });
});

// ─── IOC.createDecorator('field') ──────────────────────────────────────────────

describe("IOC.createDecorator('field')", () => {
  test("legacy mode: legacy handler receives (target, propertyKey)", () => {
    const received: any[] = [];
    const decorator = IOC.createDecorator({
      legacy: (target, propertyKey) => {
        received.push({ target, propertyKey });
      },
      tc39: (_context) => {
        return (initialValue: any) => initialValue;
      }
    }, 'field');

    const target = {};
    decorator(target, "myField");

    expect(received).toHaveLength(1);
    expect(received[0].target).toBe(target);
    expect(received[0].propertyKey).toBe("myField");
  });

  test("TC39 mode: tc39 handler receives context", () => {
    const received: any[] = [];
    const decorator = IOC.createDecorator({
      legacy: (_target, _propertyKey) => {},
      tc39: (context) => {
        received.push(context);
        return (initialValue: any) => initialValue;
      }
    }, 'field');

    const tc39Context = { kind: "field", name: "myField", metadata: {} };
    const result = decorator(undefined, tc39Context);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(tc39Context);
    // result is the initializer function returned by tc39 handler
    expect(typeof result).toBe("function");
  });

  test("TC39 mode: tc39 handler initializer transforms value", () => {
    const decorator = IOC.createDecorator({
      legacy: (_target, _propertyKey) => {},
      tc39: (_context) => {
        return (initialValue: any) => initialValue * 2;
      }
    }, 'field');

    const tc39Context = { kind: "field", name: "myField", metadata: {} };
    const initializer = decorator(undefined, tc39Context);
    expect(typeof initializer).toBe("function");
    expect(initializer(5)).toBe(10);
  });

  test("legacy mode: legacy handler return value is forwarded", () => {
    const decorator = IOC.createDecorator({
      legacy: (_target, _propertyKey) => {
        return "legacy-result";
      },
      tc39: (_context) => {
        return (initialValue: any) => initialValue;
      }
    }, 'field');

    const result = decorator({}, "myField");
    expect(result).toBe("legacy-result");
  });

  test("TC39 mode: tc39 handler can return void", () => {
    const decorator = IOC.createDecorator({
      legacy: (_target, _propertyKey) => {},
      tc39: (_context) => {
        // no return
      }
    }, 'field');

    const tc39Context = { kind: "field", name: "myField", metadata: {} };
    const result = decorator(undefined, tc39Context);
    expect(result).toBeUndefined();
  });
});
