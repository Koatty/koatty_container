import { IOC } from "../src/container/Container";
import { CircularDepError } from "../src/utils/CircularDepDetector";
import { Autowired } from "../src/decorator/Autowired";

// normal non-circular dependency
class DatabaseService {
  connect() {
    return "connected";
  }
}

class UserRepository {
  @Autowired()
  databaseService: DatabaseService;

  findUser() {
    return "user found";
  }
}

// simple bidirectional circular dependency
class UserService {
  @Autowired()
  orderService: OrderService;

  getUser() {
    return "user";
  }
}

class OrderService {
  @Autowired()
  userService: UserService;

  getOrder() {
    return "order";
  }
}

// circular dependency with lazy loading
class NotificationService {
  @Autowired()
  paymentService: PaymentService;

  sendNotification() {
    return "notification sent";
  }
}

class PaymentService {
  @Autowired("NotificationService", "COMPONENT", [], true)
  notificationService: NotificationService;

  processPayment() {
    return "payment processed";
  }
}

// test circular dependency classes
class ServiceA {
  @Autowired()
  serviceB: ServiceB;

  getValue() {
    return "A";
  }
}

class ServiceB {
  @Autowired()
  serviceC: ServiceC;

  getValue() {
    return "B";
  }
}

class ServiceC {
  @Autowired()
  serviceA: ServiceA;

  getValue() {
    return "C";
  }
}

describe("Circular Dependency Detection", () => {
  beforeEach(() => {
    IOC.clear();
  });

  describe("Circular Dependency Detection", () => {
    test("Should detect simple circular dependency", () => {
      expect(() => {
        IOC.reg(UserService);
        IOC.reg(OrderService);
      }).toThrow(CircularDepError);
    });

    test("Should detect complex circular dependency chain", () => {
      expect(() => {
        IOC.reg(ServiceA);
        IOC.reg(ServiceB);
        IOC.reg(ServiceC);
      }).toThrow(CircularDepError);
    });

    test("Should handle delayed loading for circular dependencies", () => {
      expect(() => {
        IOC.reg(PaymentService);
        IOC.reg(NotificationService);
      }).not.toThrow();

      // lazy loading should avoid circular dependency
      const paymentService = IOC.get(PaymentService);
      expect(paymentService).toBeDefined();
      expect(paymentService.processPayment()).toBe("payment processed");
    });

    test("Should allow normal non-circular dependencies", () => {
      expect(() => {
        IOC.reg(DatabaseService);
        IOC.reg(UserRepository);
      }).not.toThrow();

      const userRepo = IOC.get(UserRepository);
      expect(userRepo).toBeDefined();
      expect(userRepo.findUser()).toBe("user found");
      expect(userRepo.databaseService).toBeDefined();
      expect(userRepo.databaseService.connect()).toBe("connected");
    });
  });

  describe("Circular Dependency Detector Methods", () => {
    test("Should check if circular dependencies exist", () => {
      try {
        IOC.reg(UserService);
        IOC.reg(OrderService);
      } catch (error) {
        // expect to throw an error
      }

      const detector = IOC.getCircularDependencyDetector();
      expect(detector.hasCircularDependencies()).toBe(true);
    });

    test("Should get all circular dependencies", () => {
      try {
        IOC.reg(ServiceA);
        IOC.reg(ServiceB);
        IOC.reg(ServiceC);
      } catch (error) {
        // expect to throw an error
      }

      const detector = IOC.getCircularDependencyDetector();
      const cycles = detector.getAllCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });

    test("Should generate dependency report", () => {
      IOC.reg(DatabaseService);
      IOC.reg(UserRepository);

      const detector = IOC.getCircularDependencyDetector();
      const report = detector.generateDependencyReport();
      
      expect(report.totalComponents).toBeGreaterThan(0);
      expect(report.circularDependencies).toBeDefined();
      expect(report.unresolvedComponents).toBeDefined();
    });

    test("Should provide resolution suggestions", () => {
      const detector = IOC.getCircularDependencyDetector();
      const suggestions = detector.getResolutionSuggestions(["ServiceA", "ServiceB", "ServiceA"]);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes("lazy loading"))).toBe(true);
    });

    test("Should visualize dependency graph", () => {
      IOC.reg(DatabaseService);
      IOC.reg(UserRepository);

      const detector = IOC.getCircularDependencyDetector();
      const visualization = detector.getDependencyGraphVisualization();
      
      expect(visualization).toContain("依赖关系图");
      expect(visualization).toContain("DatabaseService");
      expect(visualization).toContain("UserRepository");
    });
  });

  describe("Container Integration", () => {
    test("Should provide container-level circular dependency checking", () => {
      IOC.reg(DatabaseService);
      IOC.reg(UserRepository);

      expect(IOC.hasCircularDependencies()).toBe(false);
      
      const cycles = IOC.getCircularDependencies();
      expect(cycles).toEqual([]);
    });

    test("Should generate dependency report from container", () => {
      IOC.reg(DatabaseService);
      IOC.reg(UserRepository);

      // 这应该不会抛出错误
      expect(() => {
        IOC.generateDependencyReport();
      }).not.toThrow();
    });
  });

  describe("Error Information", () => {
    test("Should provide detailed error information", () => {
      try {
        IOC.reg(UserService);
        IOC.reg(OrderService);
      } catch (error) {
        if (error instanceof CircularDepError) {
          expect(error.dependencyChain).toBeDefined();
          expect(error.circularPath).toBeDefined();
          expect(error.getDetailedMessage()).toContain("依赖链");
          expect(error.getDetailedMessage()).toContain("循环路径");
          
          const json = error.toJSON();
          expect(json.name).toBe("CircularDepError");
          expect(json.dependencyChain).toBeDefined();
          expect(json.circularPath).toBeDefined();
        }
      }
    });
  });
}); 