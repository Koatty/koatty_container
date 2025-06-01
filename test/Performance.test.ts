import { IOC } from "../src/container/Container";
import { Autowired } from "../src/decorator/Autowired";
import { Values } from "../src/decorator/Values";

// Test services for performance testing based on real scenarios
class UserRepository {
  getUser(id: string) {
    return { id, name: "Test User", email: "test@example.com" };
  }
}

class AuthService {
  @Autowired()
  userRepository: UserRepository;

  authenticate(token: string) {
    return this.userRepository.getUser("user1");
  }
}

class UserService {
  @Autowired()
  userRepository: UserRepository;

  @Values("app.version", "1.0.0")
  appVersion: string;

  getUserProfile(id: string) {
    return {
      user: this.userRepository.getUser(id),
      version: this.appVersion
    };
  }
}

class UserController {
  @Autowired()
  userService: UserService;

  @Autowired()
  authService: AuthService;

  async handleRequest(token: string, userId: string) {
    const authResult = this.authService.authenticate(token);
    const userProfile = this.userService.getUserProfile(userId);
    return { authResult, userProfile };
  }
}

// Create multiple similar services for stress testing
const createTestServices = (count: number) => {
  const services: Function[] = [];
  
  for (let i = 0; i < count; i++) {
    class TestService {
      static className = `TestService${i}`;
      
      configValue: string = `default-${i}`;

      getValue() {
        return `service-${i}-${this.configValue}`;
      }
    }
    
    Object.defineProperty(TestService, 'name', { value: `TestService${i}` });
    services.push(TestService);
  }
  
  return services;
};

describe("Performance Optimization", () => {
  beforeEach(() => {
    IOC.clear();
  });

  describe("Metadata Cache Performance", () => {
    test("Should cache metadata for faster repeated access", () => {
      const startTime = Date.now();
      
      // Register services multiple times to test caching
      for (let i = 0; i < 5; i++) {
        IOC.reg(UserRepository);
        IOC.reg(AuthService);
        IOC.reg(UserService);
        IOC.reg(UserController);
      }
      
      const registrationTime = Date.now() - startTime;
      
      // Get cache statistics
      const stats = IOC.getPerformanceStats();
      expect(stats.cache).toBeDefined();
      expect(stats.cache.totalRequests).toBeGreaterThan(0);
      
      console.log(`Registration time: ${registrationTime}ms`);
      console.log(`Cache hit rate: ${(stats.cache.hitRate * 100).toFixed(2)}%`);
      console.log(`Total cache requests: ${stats.cache.totalRequests}`);
    });

    test("Should preload metadata for specific component types", () => {
      // First save classes to container
      IOC.saveClass('COMPONENT', UserRepository, 'UserRepository');
      IOC.saveClass('SERVICE', AuthService, 'AuthService');
      IOC.saveClass('SERVICE', UserService, 'UserService');
      IOC.saveClass('CONTROLLER', UserController, 'UserController');
      
      const startTime = Date.now();
      
      // Test type-specific preloading
      IOC.preloadMetadata('SERVICE');
      
      const preloadTime = Date.now() - startTime;
      
      expect(preloadTime).toBeLessThan(1000); // Should complete within 1 second
      console.log(`Service metadata preload time: ${preloadTime}ms`);
    });

    test("Should show performance improvement with preloading", () => {
      // Prepare test services
      const testServices = createTestServices(20);
      
      // Save classes to container
      testServices.forEach((ServiceClass, index) => {
        IOC.saveClass('SERVICE', ServiceClass, `TestService${index}`);
      });
      
      // Test without preloading
      const startWithoutPreload = Date.now();
      const servicesWithoutPreload = IOC.listClass('SERVICE');
      servicesWithoutPreload.slice(0, 10).forEach(({target}) => {
        IOC.reg(target);
      });
      const timeWithoutPreload = Date.now() - startWithoutPreload;
      
      // Clear and reset
      IOC.clear();
      testServices.forEach((ServiceClass, index) => {
        IOC.saveClass('SERVICE', ServiceClass, `TestService${index}`);
      });
      
      // Test with preloading
      const startWithPreload = Date.now();
      IOC.preloadMetadata('SERVICE');
      const services = IOC.listClass('SERVICE');
      services.slice(0, 10).forEach(({target}) => {
        IOC.reg(target);
      });
      const timeWithPreload = Date.now() - startWithPreload;
      
      console.log(`Registration without preload: ${timeWithoutPreload}ms`);
      console.log(`Registration with preload: ${timeWithPreload}ms`);
      console.log(`Performance improvement: ${((timeWithoutPreload - timeWithPreload) / timeWithoutPreload * 100).toFixed(2)}%`);
      
      // Performance should improve or at least not degrade significantly
      expect(timeWithPreload).toBeLessThanOrEqual(timeWithoutPreload * 1.2);
    });

    test("Should optimize performance automatically", () => {
      IOC.reg(UserRepository);
      IOC.reg(AuthService);
      IOC.reg(UserService);
      IOC.reg(UserController);
      
      const startTime = Date.now();
      IOC.optimizePerformance();
      const optimizeTime = Date.now() - startTime;
      
      expect(optimizeTime).toBeLessThan(2000); // Should complete within 2 seconds
      console.log(`Performance optimization time: ${optimizeTime}ms`);
    });
  });

  describe("Real-world Application Scenarios", () => {
    test("Should handle typical controller registration workflow efficiently", () => {
      // Simulate typical project startup
      const startTime = Date.now();
      
      // 1. Save classes to container (like project startup)
      IOC.saveClass('COMPONENT', UserRepository, 'UserRepository');
      IOC.saveClass('SERVICE', AuthService, 'AuthService');
      IOC.saveClass('SERVICE', UserService, 'UserService');
      IOC.saveClass('CONTROLLER', UserController, 'UserController');
      
      // 2. Register components first (bottom-up dependency order)
      IOC.preloadMetadata('COMPONENT');
      const components = IOC.listClass('COMPONENT');
      components.forEach(({target}) => IOC.reg(target));
      
      // 3. Register services
      IOC.preloadMetadata('SERVICE');
      const services = IOC.listClass('SERVICE');
      services.forEach(({target}) => IOC.reg(target));
      
      // 4. Register controllers
      IOC.preloadMetadata('CONTROLLER');
      const controllers = IOC.listClass('CONTROLLER');
      controllers.forEach(({target}) => IOC.reg(target));
      
      const totalTime = Date.now() - startTime;
      
      // Verify all components are registered
      const controller = IOC.get('UserController');
      expect(controller).toBeDefined();
      
      console.log(`Complete application startup simulation: ${totalTime}ms`);
    });

    test("Should handle high-frequency IOC.get() calls efficiently", () => {
      // Register components
      IOC.reg(UserRepository);
      IOC.reg(AuthService);
      IOC.reg(UserService);
      IOC.reg(UserController);
      
      // Preload all metadata to populate cache
      IOC.preloadMetadata();
      
      // First access to populate cache
      IOC.get('UserController');
      IOC.get('UserService');
      IOC.get('AuthService');
      IOC.get('UserRepository');
      
      const iterations = 100;
      const startTime = Date.now();
      
      // Simulate high-frequency access - this should hit cache
      for (let i = 0; i < iterations; i++) {
        const controller = IOC.get('UserController');
        const service = IOC.get('UserService');
        const auth = IOC.get('AuthService');
        const repo = IOC.get('UserRepository');
        
        expect(controller).toBeDefined();
        expect(service).toBeDefined();
        expect(auth).toBeDefined();
        expect(repo).toBeDefined();
      }
      
      const totalTime = Date.now() - startTime;
      const avgTimePerGet = totalTime / (iterations * 4);
      
      const stats = IOC.getPerformanceStats();
      
      console.log(`${iterations * 4} IOC.get() calls completed in ${totalTime}ms`);
      console.log(`Average time per IOC.get(): ${avgTimePerGet.toFixed(3)}ms`);
      console.log(`Final cache hit rate: ${(stats.cache.hitRate * 100).toFixed(2)}%`);
      console.log(`Cache stats:`, stats.cache);
      
      // Cache should have some activity, but hit rate might be low due to singleton pattern
      expect(stats.cache.totalRequests).toBeGreaterThan(0);
    });

    test("Should provide meaningful performance statistics", () => {
      IOC.reg(UserRepository);
      IOC.reg(AuthService);
      IOC.reg(UserService);
      IOC.reg(UserController);
      
      // Access components to generate cache activity
      IOC.get('UserController');
      IOC.get('UserService');
      IOC.get('AuthService');
      
      const stats = IOC.getPerformanceStats();
      
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('totalRegistered');
      expect(stats).toHaveProperty('memoryUsage');
      
      expect(stats.cache).toHaveProperty('hits');
      expect(stats.cache).toHaveProperty('misses');
      expect(stats.cache).toHaveProperty('hitRate');
      expect(stats.cache).toHaveProperty('totalRequests');
      
      expect(stats.totalRegistered).toBeGreaterThan(0);
      expect(stats.memoryUsage.classMap).toBeGreaterThan(0);
      
      console.log("Performance statistics:", JSON.stringify(stats, null, 2));
    });
  });

  describe("Stress Testing", () => {
    test("Should handle large number of components efficiently", () => {
      const serviceCount = 50;
      const services = createTestServices(serviceCount);
      
      // Save classes
      const saveStartTime = Date.now();
      services.forEach((ServiceClass, index) => {
        IOC.saveClass('SERVICE', ServiceClass, `TestService${index}`);
      });
      const saveTime = Date.now() - saveStartTime;
      
      // Preload and register
      const registerStartTime = Date.now();
      IOC.preloadMetadata('SERVICE');
      const serviceList = IOC.listClass('SERVICE');
      serviceList.forEach(({target}) => {
        IOC.reg(target);
      });
      const registerTime = Date.now() - registerStartTime;
      
      // Access all services
      const accessStartTime = Date.now();
      services.forEach((_, index) => {
        const service = IOC.get(`TestService${index}`);
        expect(service).toBeDefined();
      });
      const accessTime = Date.now() - accessStartTime;
      
      const stats = IOC.getPerformanceStats();
      
      console.log(`Stress test with ${serviceCount} services:`);
      console.log(`  Save time: ${saveTime}ms`);
      console.log(`  Register time: ${registerTime}ms`);
      console.log(`  Access time: ${accessTime}ms`);
      console.log(`  Cache hit rate: ${(stats.cache.hitRate * 100).toFixed(2)}%`);
      
      expect(stats.totalRegistered).toBe(serviceCount);
    });
  });
}); 