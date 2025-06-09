import "reflect-metadata";
import { Values } from "../src/decorator/values";
import { IOC } from "../src/container/container";
import { TAGGED_ARGS } from "../src/container/icontainer";

// Mock IOC for testing
jest.mock("../src/container/container", () => ({
  IOC: {
    savePropertyData: jest.fn()
  }
}));

describe("Values Decorator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Value Assignment", () => {
    it("should assign string value correctly", () => {
      class TestClass {
        @Values("test string")
        name: string;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "name",
          method: "test string"
        },
        TestClass.prototype,
        "name"
      );
    });

    it("should assign number value correctly", () => {
      class TestClass {
        @Values(42)
        count: number;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "count",
          method: 42
        },
        TestClass.prototype,
        "count"
      );
    });

    it("should assign boolean value correctly", () => {
      class TestClass {
        @Values(true)
        isActive: boolean;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "isActive",
          method: true
        },
        TestClass.prototype,
        "isActive"
      );
    });

    it("should assign object value correctly", () => {
      const testObj = { key: "value" };
      
      class TestClass {
        @Values(testObj)
        config: object;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "config",
          method: testObj
        },
        TestClass.prototype,
        "config"
      );
    });
  });

  describe("Function Values", () => {
    it("should assign function value without execution", () => {
      const testFunction = () => "dynamic value";
      
      class TestClass {
        @Values(testFunction)
        dynamicProp: any;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "dynamicProp",
          method: testFunction
        },
        TestClass.prototype,
        "dynamicProp"
      );
    });
  });

  describe("Default Values", () => {
    it("should use default value when main value is null", () => {
      class TestClass {
        @Values(null, "default value")
        title: string;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "title",
          method: "default value"
        },
        TestClass.prototype,
        "title"
      );
    });

    it("should use default value when main value is undefined", () => {
      class TestClass {
        @Values(undefined, "default value")
        description: string;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "description",
          method: "default value"
        },
        TestClass.prototype,
        "description"
      );
    });

    it("should use default value when main value is empty string", () => {
      class TestClass {
        @Values("", "default value")
        emptyProp: string;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "emptyProp",
          method: "default value"
        },
        TestClass.prototype,
        "emptyProp"
      );
    });

    it("should use main value when it's not empty", () => {
      class TestClass {
        @Values("main value", "default value")
        normalProp: string;
      }

      expect(IOC.savePropertyData).toHaveBeenCalledWith(
        TAGGED_ARGS,
        {
          name: "normalProp",
          method: "main value"
        },
        TestClass.prototype,
        "normalProp"
      );
    });
  });

  describe("Type Checking", () => {
    it("should pass type check for matching string type", () => {
      expect(() => {
        class TestClass {
          @Values("string value")
          name: string;
        }
      }).not.toThrow();
    });

    it("should pass type check for matching number type", () => {
      expect(() => {
        class TestClass {
          @Values(123)
          count: number;
        }
      }).not.toThrow();
    });

    it("should pass type check for matching boolean type", () => {
      expect(() => {
        class TestClass {
          @Values(true)
          isActive: boolean;
        }
      }).not.toThrow();
    });

    it("should pass type check for matching object type", () => {
      expect(() => {
        class TestClass {
          @Values({ key: "value" })
          config: object;
        }
      }).not.toThrow();
    });

    it("should pass type check for Array type (object)", () => {
      expect(() => {
        class TestClass {
          @Values([1, 2, 3])
          items: Array<number>;
        }
      }).not.toThrow();
    });

    it("should pass type check for Date type (object)", () => {
      expect(() => {
        class TestClass {
          @Values(new Date())
          createdAt: Date;
        }
      }).not.toThrow();
    });

    it("should throw error for type mismatch - string vs number", () => {
      expect(() => {
        class TestClass {
          @Values(123) // number value
          name: string; // string type
        }
      }).toThrow("Type mismatch: expected string, but received number for property 'name'");
    });

    it("should throw error for type mismatch - number vs string", () => {
      expect(() => {
        class TestClass {
          @Values("123") // string value
          count: number; // number type
        }
      }).toThrow("Type mismatch: expected number, but received string for property 'count'");
    });

    it("should throw error for type mismatch - boolean vs string", () => {
      expect(() => {
        class TestClass {
          @Values("true") // string value
          isActive: boolean; // boolean type
        }
      }).toThrow("Type mismatch: expected boolean, but received string for property 'isActive'");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null values without type checking", () => {
      expect(() => {
        class TestClass {
          @Values(null)
          nullProp: string;
        }
      }).not.toThrow();
    });

    it("should handle undefined values without type checking", () => {
      expect(() => {
        class TestClass {
          @Values(undefined)
          undefinedProp: string;
        }
      }).not.toThrow();
    });

    it("should handle properties without type metadata", () => {
      // Mock Reflect.getMetadata to return undefined
      const originalGetMetadata = Reflect.getMetadata;
      jest.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);

      expect(() => {
        class TestClass {
          @Values("any value")
          anyProp: any;
        }
      }).not.toThrow();

      Reflect.getMetadata = originalGetMetadata;
    });

    it("should handle unknown type gracefully", () => {
      // Mock Reflect.getMetadata to return a type without name
      const originalGetMetadata = Reflect.getMetadata;
      jest.spyOn(Reflect, 'getMetadata').mockReturnValue({ name: undefined });

      expect(() => {
        class TestClass {
          @Values("any value")
          unknownProp: any;
        }
      }).not.toThrow();

      Reflect.getMetadata = originalGetMetadata;
    });

    it("should handle custom type that is not in type mapping", () => {
      // Mock Reflect.getMetadata to return a custom type
      const originalGetMetadata = Reflect.getMetadata;
      jest.spyOn(Reflect, 'getMetadata').mockReturnValue({ name: 'CustomType' });

      expect(() => {
        class TestClass {
          @Values("custom value")
          customProp: any;
        }
      }).toThrow("Type mismatch: expected customtype, but received string for property 'customProp'");

      Reflect.getMetadata = originalGetMetadata;
    });
  });
});