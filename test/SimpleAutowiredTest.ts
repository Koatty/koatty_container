import { IOC } from "../src/container/Container";
import { Autowired } from "../src/decorator/Autowired";
import { Component } from "../src/decorator/Component";
import { TAGGED_PROP } from "../src/container/IContainer";

@Component()
class SimpleService {
  getValue() {
    return "simple";
  }
}

@Component()  
class TestService {
  @Autowired()
  simpleService: SimpleService;

  getResult() {
    return this.simpleService?.getValue();
  }
}

describe("Simple Autowired Test", () => {
  beforeEach(() => {
    IOC.clear();
  });

  test("Should save and read @Autowired metadata correctly", () => {
    console.log("=== TESTING SIMPLE AUTOWIRED ===");
    
    // Check metadata before registration
    const beforeMeta = IOC.listPropertyData(TAGGED_PROP, TestService.prototype);
    console.log("TestService metadata before registration:", beforeMeta);
    
    const reflectMeta = Reflect.getMetadata(TAGGED_PROP, TestService.prototype);
    console.log("TestService Reflect metadata:", reflectMeta);
    
    // Try direct reflection
    const allKeys = Reflect.getMetadataKeys(TestService.prototype);
    console.log("All metadata keys:", allKeys);
    
    // Register services
    IOC.reg(SimpleService);
    IOC.reg(TestService);
    
    // Check metadata after registration
    const afterMeta = IOC.listPropertyData(TAGGED_PROP, TestService.prototype);  
    console.log("TestService metadata after registration:", afterMeta);
    
    // Try to get instance
    const instance = IOC.get(TestService);
    console.log("Instance created:", !!instance);
    console.log("Simple service injected:", !!instance.simpleService);
    
    if (instance.simpleService) {
      console.log("Injection works! Result:", instance.getResult());
      expect(instance.getResult()).toBe("simple");
    } else {
      console.log("Injection failed - simpleService is undefined");
      expect(instance.simpleService).toBeDefined();
    }
  });
}); 