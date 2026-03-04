import "reflect-metadata";
import { 
  createLazyProxy,
  isLazyProxy,
  isLazyProxyResolved
} from "../src/utils/lazy_proxy";

describe("LazyProxy", () => {
  describe("createLazyProxy", () => {
    it("resolver should only be called on first property access", () => {
      let callCount = 0;
      const resolver = () => {
        callCount++;
        return { value: 42 };
      };

      const proxy = createLazyProxy(resolver, "TestService");
      
      // Resolver should not be called yet
      expect(callCount).toBe(0);
      
      // Access property to trigger resolution
      const value = proxy.value;
      expect(callCount).toBe(1);
      expect(value).toBe(42);
    });

    it("should cache resolved value and not call resolver on subsequent accesses", () => {
      let callCount = 0;
      const resolver = () => {
        callCount++;
        return { name: "test", count: 0 };
      };

      const proxy = createLazyProxy(resolver, "TestService");
      
      // First access
      expect(proxy.name).toBe("test");
      expect(callCount).toBe(1);
      
      // Second access - should use cache
      expect(proxy.name).toBe("test");
      expect(callCount).toBe(1);
      
      // Third access - still cached
      expect(proxy.count).toBe(0);
      expect(callCount).toBe(1);
    });

    it("should throw clear error when resolver throws an exception", () => {
      const resolver = (): { value: number } => {
        throw new Error("Resolution failed!");
      };

      const proxy = createLazyProxy(resolver, "FailingService");
      
      expect(() => proxy.value).toThrow("Resolution failed!");
    });

    it("should throw error when resolver returns null or undefined", () => {
      const nullResolver = () => null as any;
      const undefinedResolver = () => undefined as any;

      const nullProxy = createLazyProxy<{ value: number }>(nullResolver, "NullService");
      const undefinedProxy = createLazyProxy<{ value: number }>(undefinedResolver, "UndefinedService");
      
      expect(() => nullProxy.value).toThrow(/Lazy dependency resolution failed for: NullService/);
      expect(() => undefinedProxy.value).toThrow(/Lazy dependency resolution failed for: UndefinedService/);
    });

    it("should cache error and rethrow on subsequent accesses", () => {
      let callCount = 0;
      const resolver = (): { value: number } => {
        callCount++;
        throw new Error("Resolution failed!");
      };

      const proxy = createLazyProxy(resolver, "FailingService");
      
      // First access throws
      expect(() => proxy.value).toThrow("Resolution failed!");
      expect(callCount).toBe(1);
      
      // Second access should also throw (cached error), but not call resolver again
      expect(() => proxy.value).toThrow("Resolution failed!");
      expect(callCount).toBe(1);
    });
  });

  describe("isLazyProxy", () => {
    it("should return true for lazy proxy objects", () => {
      const proxy = createLazyProxy(() => ({ value: 1 }), "TestService");
      expect(isLazyProxy(proxy)).toBe(true);
    });

    it("should return false for regular objects", () => {
      const regularObj = { value: 1 };
      expect(isLazyProxy(regularObj)).toBe(false);
    });

    it("should return false for null and undefined", () => {
      expect(isLazyProxy(null)).toBe(false);
      expect(isLazyProxy(undefined)).toBe(false);
    });

    it("should return false for primitive values", () => {
      expect(isLazyProxy(42)).toBe(false);
      expect(isLazyProxy("string")).toBe(false);
      expect(isLazyProxy(true)).toBe(false);
    });

    it("should handle objects that throw on property access", () => {
      const throwingObj = {
        get [Symbol('koatty_lazy_proxy')]() {
          throw new Error("Cannot access");
        }
      };
      // Should not throw, just return false
      expect(isLazyProxy(throwingObj)).toBe(false);
    });
  });

  describe("isLazyProxyResolved", () => {
    it("should return false before first property access", () => {
      const proxy = createLazyProxy(() => ({ value: 1 }), "TestService");
      expect(isLazyProxyResolved(proxy)).toBe(false);
    });

    it("should return true after first property access", () => {
      const proxy = createLazyProxy(() => ({ value: 1 }), "TestService");
      
      // Access property to trigger resolution
      const _ = proxy.value;
      
      expect(isLazyProxyResolved(proxy)).toBe(true);
    });

    it("should return false for non-proxy objects", () => {
      const regularObj = { value: 1 };
      expect(isLazyProxyResolved(regularObj)).toBe(false);
    });

    it("should return false for null and undefined", () => {
      expect(isLazyProxyResolved(null)).toBe(false);
      expect(isLazyProxyResolved(undefined)).toBe(false);
    });
  });

  describe("Proxy traps", () => {
    it("should correctly forward set trap", () => {
      const proxy = createLazyProxy(() => ({ value: 1 }), "TestService");
      
      proxy.value = 100;
      expect(proxy.value).toBe(100);
    });

    it("should correctly forward has trap", () => {
      const proxy = createLazyProxy(() => ({ existingProp: "value" }), "TestService");
      
      expect("existingProp" in proxy).toBe(true);
      expect("nonExistingProp" in proxy).toBe(false);
    });

    it("should correctly forward ownKeys trap", () => {
      const proxy = createLazyProxy(() => ({ 
        prop1: "value1", 
        prop2: "value2" 
      }), "TestService");
      
      const keys = Object.keys(proxy);
      expect(keys).toContain("prop1");
      expect(keys).toContain("prop2");
    });

    it("should correctly forward getOwnPropertyDescriptor trap", () => {
      const proxy = createLazyProxy(() => ({ value: 1 }), "TestService");
      
      const descriptor = Object.getOwnPropertyDescriptor(proxy, "value");
      expect(descriptor).toBeDefined();
      expect(descriptor?.value).toBe(1);
      expect(descriptor?.enumerable).toBe(true);
      expect(descriptor?.writable).toBe(true);
    });

    it("should correctly forward getPrototypeOf trap", () => {
      class TestClass {
        value = 1;
      }
      
      const proxy = createLazyProxy(() => new TestClass(), "TestService");
      
      const proto = Object.getPrototypeOf(proxy);
      expect(proto).toBe(TestClass.prototype);
    });

    it("should work with methods on resolved object", () => {
      const proxy = createLazyProxy(() => ({
        greet(name: string) {
          return `Hello, ${name}!`;
        }
      }), "TestService");
      
      expect(proxy.greet("World")).toBe("Hello, World!");
    });

    it("should work with nested object access", () => {
      const proxy = createLazyProxy(() => ({
        nested: {
          deep: {
            value: "found"
          }
        }
      }), "TestService");
      
      expect(proxy.nested.deep.value).toBe("found");
    });
  });

  describe("Edge cases", () => {
    it("should work with Symbol properties", () => {
      const sym = Symbol('test');
      const proxy = createLazyProxy(() => ({
        [sym]: "symbol value"
      }), "TestService");
      
      expect((proxy as any)[sym]).toBe("symbol value");
    });

    it("should work with array-like objects", () => {
      const proxy = createLazyProxy(() => [1, 2, 3] as any, "TestService");
      
      expect(proxy[0]).toBe(1);
      expect(proxy.length).toBe(3);
    });

    it("should work with class instances", () => {
      class TestService {
        private _value = 42;
        
        getValue() {
          return this._value;
        }
      }
      
      const proxy = createLazyProxy(() => new TestService(), "TestService");
      
      expect(proxy.getValue()).toBe(42);
    });

    it("should handle toString and valueOf", () => {
      const proxy = createLazyProxy(() => ({
        toString() { return "proxy-string"; },
        valueOf() { return 999; }
      }), "TestService");
      
      expect(String(proxy)).toBe("proxy-string");
      expect(proxy.valueOf()).toBe(999);
    });
  });
});
