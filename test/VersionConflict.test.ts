import { VersionConflictDetector, VersionConflictError } from "../src/utils/VersionConflictDetector";
import { Container, IOC, ensureIOCReady } from "../src/container/Container";

describe("Version Conflict Detection and Resolution", () => {
  beforeEach(() => {
    // 清理全局版本注册表
    delete (<any>global).__KOATTY_CONTAINER_VERSIONS__;
    delete (<any>global).__KOATTY_IOC__;
    
    // 重置Container状态
    (<any>Container).instance = null;
    (<any>Container).isInitializing = false;
    (<any>Container).initializationPromise = null;
  });

  describe("Version Registration and Detection", () => {
    test("Should register version correctly", () => {
      const detector = new VersionConflictDetector("1.12.0");
      detector.registerVersion();
      
      const versionInfo = detector.getVersionInfo();
      expect(versionInfo.version).toBe("1.12.0");
      expect(versionInfo.instanceId).toBeDefined();
      expect(versionInfo.timestamp).toBeDefined();
    });

    test("Should detect no conflict with single version", () => {
      const detector = new VersionConflictDetector("1.12.0");
      detector.registerVersion();
      
      const conflict = detector.detectVersionConflicts();
      expect(conflict).toBeNull();
    });

    test("Should detect conflict with multiple versions", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("1.11.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      
      const conflict1 = detector1.detectVersionConflicts();
      const conflict2 = detector2.detectVersionConflicts();
      
      expect(conflict1).toBeInstanceOf(VersionConflictError);
      expect(conflict2).toBeInstanceOf(VersionConflictError);
      
      if (conflict1) {
        expect(conflict1.currentVersion).toBe("1.12.0");
        expect(conflict1.conflictingVersions).toHaveLength(1);
        expect(conflict1.conflictingVersions[0].version).toBe("1.11.0");
      }
    });

    test("Should provide detailed conflict information", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("1.11.0");
      const detector3 = new VersionConflictDetector("1.10.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      detector3.registerVersion();
      
      const conflict = detector1.detectVersionConflicts();
      expect(conflict).toBeInstanceOf(VersionConflictError);
      
      if (conflict) {
        const details = conflict.getConflictDetails();
        expect(details).toContain("Current version: 1.12.0");
        expect(details).toContain("Conflicting versions found:");
        expect(details).toContain("Version 1.11.0");
        expect(details).toContain("Version 1.10.0");
        
        const suggestions = conflict.getResolutionSuggestions();
        expect(suggestions).toContain("1. 统一所有依赖的koatty_container版本");
        expect(suggestions).toContain("2. 使用npm ls koatty_container检查版本依赖树");
      }
    });
  });

  describe("Version Compatibility", () => {
    test("Should check version compatibility correctly", () => {
      const detector = new VersionConflictDetector("1.12.0");
      
      // 兼容的版本
      expect(detector.checkVersionCompatibility("1.12.1")).toBe(true);
      expect(detector.checkVersionCompatibility("1.11.0")).toBe(true);
      expect(detector.checkVersionCompatibility("1.10.0")).toBe(true);
      expect(detector.checkVersionCompatibility("1.14.0")).toBe(true);
      
      // 不兼容的版本
      expect(detector.checkVersionCompatibility("2.0.0")).toBe(false); // 主版本号不同
      expect(detector.checkVersionCompatibility("0.9.0")).toBe(false); // 主版本号不同
      expect(detector.checkVersionCompatibility("1.8.0")).toBe(false); // 次版本号差异太大
      expect(detector.checkVersionCompatibility("1.16.0")).toBe(false); // 次版本号差异太大
    });

    test("Should parse version numbers correctly", () => {
      const detector = new VersionConflictDetector("1.12.5");
      
      // 测试通过公开方法间接验证解析功能
      expect(detector.checkVersionCompatibility("1.12.5")).toBe(true);
      expect(detector.checkVersionCompatibility("1.12.6")).toBe(true);
      expect(detector.checkVersionCompatibility("1.12.4")).toBe(true);
    });
  });

  describe("Version Resolution Strategies", () => {
    test("Should recommend correct resolution strategy", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("1.11.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      
      const strategy1 = detector1.getVersionResolutionStrategy();
      const strategy2 = detector2.getVersionResolutionStrategy();
      
      // 兼容版本应该推荐使用最新版本
      expect(strategy1).toBe("use_latest");
      expect(strategy2).toBe("use_latest");
    });

    test("Should recommend manual resolution for incompatible versions", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("2.0.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      
      const strategy = detector1.getVersionResolutionStrategy();
      expect(strategy).toBe("manual_resolve");
    });

    test("Should resolve conflicts automatically", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("1.11.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      
      // 最新版本应该能够解决冲突
      const resolved1 = detector1.resolveVersionConflict("use_latest");
      expect(resolved1).toBe(true);
      
      // 较旧版本应该被标记为非最新
      const resolved2 = detector2.resolveVersionConflict("use_latest");
      expect(resolved2).toBe(false);
    });
  });

  describe("Container Integration", () => {
    test("Should detect version conflicts in Container initialization", async () => {
      // 创建一个模拟的旧版本检测器
      const oldVersionDetector = new VersionConflictDetector("1.11.0");
      oldVersionDetector.registerVersion();
      
      // 创建Container实例（会注册新版本）
      const container = await ensureIOCReady();
      
      // 检查版本冲突报告
      const report = container.generateVersionConflictReport();
      expect(report.hasConflict).toBe(true);
      expect(report.conflictError).toBeInstanceOf(VersionConflictError);
      expect(report.report.versions).toHaveLength(2);
    });

    test("Should provide version conflict information through Container", () => {
      const container = Container.getInstanceSync();
      const versionDetector = container.getVersionConflictDetector();
      
      expect(versionDetector).toBeInstanceOf(VersionConflictDetector);
      
      const versionInfo = versionDetector.getVersionInfo();
      expect(versionInfo.version).toBe("1.12.0");
    });

    test("Should handle version conflicts gracefully", async () => {
      // 注册多个版本
      const detector1 = new VersionConflictDetector("1.10.0");
      const detector2 = new VersionConflictDetector("1.11.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      
      // 容器初始化应该成功，即使存在版本冲突
      let initializationError = null;
      try {
        const container = await ensureIOCReady();
        expect(container).toBeDefined();
        expect(typeof container.reg).toBe('function');
      } catch (error) {
        initializationError = error;
      }
      
      // 应该不会抛出错误，但会记录警告
      expect(initializationError).toBeNull();
    });
  });

  describe("Global Version Management", () => {
    test("Should track all registered versions globally", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("1.11.0");
      const detector3 = new VersionConflictDetector("1.10.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      detector3.registerVersion();
      
      const allVersions = VersionConflictDetector.getAllRegisteredVersions();
      expect(allVersions).toHaveLength(3);
      
      const versions = allVersions.map(v => v.version).sort();
      expect(versions).toEqual(["1.10.0", "1.11.0", "1.12.0"]);
    });

    test("Should provide quick conflict check", () => {
      expect(VersionConflictDetector.quickConflictCheck()).toBe(false);
      
      const detector1 = new VersionConflictDetector("1.12.0");
      detector1.registerVersion();
      expect(VersionConflictDetector.quickConflictCheck()).toBe(false);
      
      const detector2 = new VersionConflictDetector("1.11.0");
      detector2.registerVersion();
      expect(VersionConflictDetector.quickConflictCheck()).toBe(true);
    });

    test("Should clean up version registration", () => {
      const detector = new VersionConflictDetector("1.12.0");
      detector.registerVersion();
      
      let allVersions = VersionConflictDetector.getAllRegisteredVersions();
      expect(allVersions).toHaveLength(1);
      
      detector.unregisterVersion();
      allVersions = VersionConflictDetector.getAllRegisteredVersions();
      expect(allVersions).toHaveLength(0);
    });
  });

  describe("Conflict Report Generation", () => {
    test("Should generate comprehensive conflict report", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("1.11.0");
      const detector3 = new VersionConflictDetector("1.10.0");
      
      detector1.registerVersion();
      detector2.registerVersion();
      detector3.registerVersion();
      
      const report = detector1.generateConflictReport();
      
      expect(report.hasConflict).toBe(true);
      expect(report.versions).toHaveLength(3);
      expect(report.recommendations).toContain("Recommended strategy: use_latest");
      expect(report.resolutionStrategy).toBe("use_latest");
      
      // 检查建议中包含有用的信息
      expect(report.recommendations.some(r => r.includes("npm ls koatty_container"))).toBe(true);
      expect(report.recommendations.some(r => r.includes("resolutions"))).toBe(true);
    });

    test("Should report no conflict when appropriate", () => {
      const detector = new VersionConflictDetector("1.12.0");
      detector.registerVersion();
      
      const report = detector.generateConflictReport();
      
      expect(report.hasConflict).toBe(false);
      expect(report.versions).toHaveLength(1);
      expect(report.resolutionStrategy).toBe("force_current");
    });
  });

  describe("Real-world Scenarios", () => {
    test("Should handle scenario with multiple incompatible versions", () => {
      const detectors = [
        new VersionConflictDetector("1.12.0"),
        new VersionConflictDetector("2.0.0"),
        new VersionConflictDetector("0.9.0")
      ];
      
      detectors.forEach(d => d.registerVersion());
      
      const report = detectors[0].generateConflictReport();
      expect(report.hasConflict).toBe(true);
      expect(report.resolutionStrategy).toBe("manual_resolve");
      
      // 应该建议手动解决
      expect(report.recommendations.some(r => r.includes("manual_resolve"))).toBe(true);
    });

    test("Should provide helpful error messages for developers", () => {
      const detector1 = new VersionConflictDetector("1.12.0");
      const detector2 = new VersionConflictDetector("1.8.0"); // 差异太大
      
      detector1.registerVersion();
      detector2.registerVersion();
      
      const conflict = detector1.detectVersionConflicts();
      if (conflict) {
        const details = conflict.getConflictDetails();
        const suggestions = conflict.getResolutionSuggestions();
        
        // 错误信息应该包含具体版本号
        expect(details).toContain("1.12.0");
        expect(details).toContain("1.8.0");
        
        // 建议应该包含实用的解决方案
        expect(suggestions.some(s => s.includes("npm ls"))).toBe(true);
        expect(suggestions.some(s => s.includes("package.json"))).toBe(true);
        expect(suggestions.some(s => s.includes("resolutions"))).toBe(true);
      }
    });
  });
}); 