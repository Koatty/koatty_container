/**
 * 测试新的 IAspectV2 接口和 AspectContext
 * 展示如何使用新的上下文对象进行 AOP 开发
 */

import { Container } from "../src/container/container";
import { IAspect, AspectContext } from "../src/container/icontainer";
import { Aspect, Before, Around, After } from "../src/decorator/aop";
import { Component } from "../src/decorator/component";
import "./Container";

const IOC = Container.getInstanceSync();

/**
 * Before 切面 - 使用新的 AspectContext 接口
 */
@Aspect()
export class ContextBeforeAspect implements IAspect {
  app: any;
  
  async run(context: AspectContext): Promise<any> {
    console.log('=== Context Before Aspect ===');
    console.log('Method:', context.getMethodName());
    console.log('Original args:', context.getOriginalArgs());
    console.log('Current args:', context.getArgs());
    
    // 修改参数
    const args = context.getArgs();
    if (args.length > 0 && typeof args[0] === 'string') {
      args[0] = `[MODIFIED]${args[0]}`;
      context.setArgs(args);
    }
    
    console.log('Args after modification:', context.getArgs());
    return Promise.resolve();
  }
}

/**
 * Around 切面 - 使用新的 AspectContext 接口
 */
@Aspect()
export class ContextAroundAspect implements IAspect {
  app: any;
  
  async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
    console.log('=== Context Around Aspect - Before ===');
    console.log('Method:', context.getMethodName());
    console.log('Target:', context.getTarget().constructor.name);
    console.log('Current args:', context.getArgs());
    console.log('Original args (immutable):', context.getOriginalArgs());
    
    // 进一步修改参数
    const args = context.getArgs();
    if (args.length > 0 && typeof args[0] === 'string') {
      args[0] = args[0].toUpperCase();
      context.setArgs(args);
    }
    
    console.log('Args modified in Around:', context.getArgs());
    
    const startTime = Date.now();
    
    if (proceed) {
      const result = await proceed();
      const duration = Date.now() - startTime;
      console.log(`=== Context Around Aspect - After (${duration}ms) ===`);
      console.log('Result:', result);
      return result;
    }
    
    return Promise.resolve();
  }
}

/**
 * After 切面 - 使用新的 AspectContext 接口
 */
@Aspect()
export class ContextAfterAspect implements IAspect {
  app: any;
  
  async run(context: AspectContext): Promise<any> {
    console.log('=== Context After Aspect ===');
    console.log('Method:', context.getMethodName());
    // After 切面可以看到所有前置切面修改后的参数
    console.log('Final args used:', context.getArgs());
    // 也可以访问原始参数
    console.log('Original args were:', context.getOriginalArgs());
    
    // 验证参数一致性
    const currentArgs = context.getArgs();
    const originalArgs = context.getOriginalArgs();
    console.log('Args were modified:', JSON.stringify(currentArgs) !== JSON.stringify(originalArgs));
    
    return Promise.resolve();
  }
}

/**
 * 测试类
 */
@Component()
export class ContextTestClass {
  @Before(ContextBeforeAspect)
  @Around(ContextAroundAspect)
  @After(ContextAfterAspect)
  async testMethod(value: string): Promise<string> {
    console.log('>>> Original method executing with:', value);
    return `Result: ${value}`;
  }
  
  @Around(ContextAroundAspect)
  async simpleMethod(name: string, age: number): Promise<string> {
    console.log('>>> Simple method executing:', name, age);
    return `${name} is ${age} years old`;
  }
}

describe("AspectContext V2 Interface", () => {
  beforeEach(() => {
    IOC.saveClass("COMPONENT", ContextBeforeAspect, "ContextBeforeAspect");
    IOC.saveClass("COMPONENT", ContextAroundAspect, "ContextAroundAspect");
    IOC.saveClass("COMPONENT", ContextAfterAspect, "ContextAfterAspect");
    IOC.saveClass("COMPONENT", ContextTestClass, "ContextTestClass");
  });

  test("AspectContext 提供完整的方法上下文信息", async () => {
    const instance: ContextTestClass = IOC.get("ContextTestClass");
    const result = await instance.testMethod("test");
    
    // 参数经过两次修改：
    // 1. ContextBeforeAspect: "test" -> "[MODIFIED]test"
    // 2. ContextAroundAspect: "[MODIFIED]test" -> "[MODIFIED]TEST"
    expect(result).toBe("Result: [MODIFIED]TEST");
  });

  test("AspectContext 保持原始参数不可变", async () => {
    const logSpy = jest.spyOn(console, 'log');
    logSpy.mockClear();

    const instance: ContextTestClass = IOC.get("ContextTestClass");
    await instance.testMethod("value");

    const logs = logSpy.mock.calls.map(call => call.join(' '));
    
    // 验证原始参数始终保持为 "value"
    const originalArgsLogs = logs.filter(log => log.includes('Original args'));
    expect(originalArgsLogs.length).toBeGreaterThan(0);
    
    // 每次显示原始参数时，都应该是 ["value"]
    originalArgsLogs.forEach(log => {
      expect(log).toContain('value');
      expect(log).not.toContain('MODIFIED');
      expect(log).not.toContain('TEST');
    });

    logSpy.mockRestore();
  });

  test("AspectContext 支持多参数方法", async () => {
    const logSpy = jest.spyOn(console, 'log');
    logSpy.mockClear();

    const instance: ContextTestClass = IOC.get("ContextTestClass");
    const result = await instance.simpleMethod("Alice", 30);

    // 参数被 Around 切面修改
    expect(result).toBe("ALICE is 30 years old");

    const logs = logSpy.mock.calls.map(call => call.join(' '));
    
    // 验证 context.getArgs() 返回完整的参数数组
    const argsLogs = logs.filter(log => log.includes('Current args'));
    expect(argsLogs.length).toBeGreaterThan(0);

    logSpy.mockRestore();
  });

  test("AspectContext 提供方法元信息", async () => {
    @Aspect()
    class MetadataAspect implements IAspect {
      app: any;
      async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
        // 访问各种元信息
        expect(context.getMethodName()).toBe('metadataTest');
        expect(context.getTarget()).toBeDefined();
        expect(context.getTarget().constructor.name).toBe('MetadataTestClass');
        expect(context.getArgs()).toEqual(['test']);
        expect(context.getOriginalArgs()).toEqual(['test']);
        
        if (proceed) {
          return await proceed();
        }
      }
    }
    
    @Component()
    class MetadataTestClass {
      @Around(MetadataAspect)
      async metadataTest(value: string): Promise<string> {
        return value;
      }
    }
    
    IOC.saveClass("COMPONENT", MetadataAspect, "MetadataAspect");
    IOC.saveClass("COMPONENT", MetadataTestClass, "MetadataTestClass");
    
    const instance: MetadataTestClass = IOC.get("MetadataTestClass");
    const result = await instance.metadataTest("test");
    
    expect(result).toBe("test");
  });

  test("AspectContext 支持自定义选项", async () => {
    @Aspect()
    class OptionsAspect implements IAspect {
      app: any;
      async run(context: AspectContext, proceed?: () => Promise<any>): Promise<any> {
        const options = context.getOptions();
        expect(options).toBeDefined();
        expect(options.timeout).toBe(3000);
        expect(options.retry).toBe(true);
        
        if (proceed) {
          return await proceed();
        }
      }
    }
    
    @Component()
    class OptionsTestClass {
      @Around(OptionsAspect, { timeout: 3000, retry: true })
      async optionsTest(): Promise<string> {
        return "success";
      }
    }
    
    IOC.saveClass("COMPONENT", OptionsAspect, "OptionsAspect");
    IOC.saveClass("COMPONENT", OptionsTestClass, "OptionsTestClass");
    
    const instance: OptionsTestClass = IOC.get("OptionsTestClass");
    const result = await instance.optionsTest();
    
    expect(result).toBe("success");
  });
});
