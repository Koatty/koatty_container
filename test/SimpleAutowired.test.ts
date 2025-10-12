import { IOC } from "../src/container/container";
import { Autowired } from "../src/decorator/autowired";
import { Component } from "../src/decorator/component";
import { TAGGED_PROP } from "../src/container/icontainer";

@Component()
class SimpleService {
  getValue() {
    return "simple";
  }
}

@Component()  
class TestService {
  @Autowired()
  simpleService!: SimpleService;

  getResult() {
    return this.simpleService?.getValue();
  }
}

describe("Simple Autowired Test", () => {
  beforeEach(() => {
    IOC.clearInstances();
  });

  test("Should save and read @Autowired metadata correctly", () => {
    console.log("=== TESTING SIMPLE AUTOWIRED ===");
    
    // Check if decorator was applied
    const hasMetadata = Reflect.hasMetadata(TAGGED_PROP, TestService.prototype);
    console.log("TestService has TAGGED_PROP metadata:", hasMetadata);
    
    // Check metadata before registration
    const beforeMeta = IOC.listPropertyData(TAGGED_PROP, TestService.prototype);
    console.log("TestService metadata before registration:", beforeMeta);
    
    const reflectMeta = Reflect.getMetadata(TAGGED_PROP, TestService.prototype);
    console.log("TestService Reflect metadata:", reflectMeta);
    
    // Try direct reflection on property
    const propMeta = Reflect.getMetadata(TAGGED_PROP, TestService.prototype, "simpleService");
    console.log("simpleService property metadata:", propMeta);
    
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