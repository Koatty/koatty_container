/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { DefaultLogger as logger } from "koatty_logger";

/**
 * 版本信息接口
 */
interface VersionInfo {
  version: string;
  timestamp: number;
  instanceId: string;
  location?: string;
}

/**
 * 版本冲突错误类
 */
export class VersionConflictError extends Error {
  public readonly conflictingVersions: VersionInfo[];
  public readonly currentVersion: string;

  constructor(message: string, conflictingVersions: VersionInfo[], currentVersion: string) {
    super(message);
    this.name = 'VersionConflictError';
    this.conflictingVersions = conflictingVersions;
    this.currentVersion = currentVersion;
  }

  /**
   * 获取详细的冲突信息
   */
  getConflictDetails(): string {
    const details = [
      `Current version: ${this.currentVersion}`,
      `Conflicting versions found:`,
      ...this.conflictingVersions.map(v => 
        `  - Version ${v.version} (ID: ${v.instanceId}${v.location ? `, Location: ${v.location}` : ''})`
      )
    ];
    return details.join('\n');
  }

  /**
   * 获取解决建议
   */
  getResolutionSuggestions(): string[] {
    return [
      "1. version conflict detected, please check the version of koatty_container in the dependency tree",
      "2. use 'npm ls koatty_container' to check the version of koatty_container in the dependency tree",
      "3. update the version of koatty_container in the package.json",
      "4. delete the node_modules and reinstall the dependencies",
      "5. consider using the resolutions field to force the version"
    ];
  }
}

/**
 * 版本冲突检测器
 * 用于检测和处理多个koatty_container版本共存的问题
 */
export class VersionConflictDetector {
  private static readonly GLOBAL_KEY = '__KOATTY_CONTAINER_VERSIONS__';
  private static readonly CURRENT_VERSION = '1.12.0';
  private static instanceCounter = 0;

  private readonly instanceId: string;
  private readonly version: string;
  private isRegistered: boolean = false;

  constructor(version: string = VersionConflictDetector.CURRENT_VERSION) {
    this.version = version;
    this.instanceId = `instance_${++VersionConflictDetector.instanceCounter}_${Date.now()}`;
  }

  /**
   * 获取全局版本注册表
   */
  private getGlobalVersionRegistry(): Map<string, VersionInfo> {
    if (!(<any>global)[VersionConflictDetector.GLOBAL_KEY]) {
      (<any>global)[VersionConflictDetector.GLOBAL_KEY] = new Map<string, VersionInfo>();
    }
    return (<any>global)[VersionConflictDetector.GLOBAL_KEY];
  }

  /**
   * 注册当前版本
   */
  public registerVersion(): void {
    if (this.isRegistered) {
      return;
    }

    const registry = this.getGlobalVersionRegistry();
    const versionInfo: VersionInfo = {
      version: this.version,
      timestamp: Date.now(),
      instanceId: this.instanceId,
      location: this.getModuleLocation()
    };

    registry.set(this.instanceId, versionInfo);
    this.isRegistered = true;

    logger.Debug(`Registered koatty_container version ${this.version} (ID: ${this.instanceId})`);
  }

  /**
   * 获取模块位置信息
   */
  private getModuleLocation(): string {
    try {
      const error = new Error();
      const stack = error.stack;
      if (stack) {
        const lines = stack.split('\n');
        for (const line of lines) {
          if (line.includes('node_modules/koatty_container')) {
            const match = line.match(/node_modules\/koatty_container[^)]+/);
            return match ? match[0] : 'unknown';
          }
        }
      }
    } catch {
      // 忽略错误
    }
    return 'unknown';
  }

  /**
   * 检测版本冲突
   */
  public detectVersionConflicts(): VersionConflictError | null {
    const registry = this.getGlobalVersionRegistry();
    const allVersions = Array.from(registry.values());
    
    if (allVersions.length <= 1) {
      return null; // 没有冲突
    }

    // 按版本分组
    const versionGroups = new Map<string, VersionInfo[]>();
    allVersions.forEach(info => {
      if (!versionGroups.has(info.version)) {
        versionGroups.set(info.version, []);
      }
      versionGroups.get(info.version)!.push(info);
    });

    // 检查是否有多个不同版本
    if (versionGroups.size > 1) {
      const conflictingVersions = allVersions.filter(v => v.version !== this.version);
      return new VersionConflictError(
        `Multiple koatty_container versions detected: ${Array.from(versionGroups.keys()).join(', ')}`,
        conflictingVersions,
        this.version
      );
    }

    return null;
  }

  /**
   * 检查版本兼容性
   */
  public checkVersionCompatibility(otherVersion: string): boolean {
    const current = this.parseVersion(this.version);
    const other = this.parseVersion(otherVersion);

    // 主版本号必须相同
    if (current.major !== other.major) {
      return false;
    }

    // 次版本号差异超过2个版本认为不兼容
    if (Math.abs(current.minor - other.minor) > 2) {
      return false;
    }

    return true;
  }

  /**
   * 解析版本号
   */
  private parseVersion(version: string): { major: number; minor: number; patch: number } {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }

  /**
   * 获取推荐的版本解决策略
   */
  public getVersionResolutionStrategy(): 'use_latest' | 'use_earliest' | 'force_current' | 'manual_resolve' {
    const registry = this.getGlobalVersionRegistry();
    const allVersions = Array.from(registry.values());

    if (allVersions.length <= 1) {
      return 'force_current';
    }

    const versions = [...new Set(allVersions.map(v => v.version))];
    
    // 检查所有版本是否兼容
    const allCompatible = versions.every(v => this.checkVersionCompatibility(v));
    
    if (allCompatible) {
      return 'use_latest';
    }

    // 如果存在不兼容版本，建议手动解决
    return 'manual_resolve';
  }

  /**
   * 执行版本冲突解决
   */
  public resolveVersionConflict(strategy: 'use_latest' | 'use_earliest' | 'force_current' = 'use_latest'): boolean {
    const conflict = this.detectVersionConflicts();
    if (!conflict) {
      return true; // 没有冲突
    }

    logger.Warn("Version conflict detected:", conflict.getConflictDetails());
    
    const registry = this.getGlobalVersionRegistry();
    const allVersions = Array.from(registry.values());

    try {
      switch (strategy) {
        case 'use_latest': {
          const latestVersion = this.findLatestVersion(allVersions);
          if (latestVersion.version !== this.version) {
            logger.Warn(`Using latest version ${latestVersion.version} instead of ${this.version}`);
            return false; // 当前版本不是最新的
          }
          break;
        }
        
        case 'use_earliest': {
          const earliestVersion = this.findEarliestVersion(allVersions);
          if (earliestVersion.version !== this.version) {
            logger.Warn(`Using earliest version ${earliestVersion.version} instead of ${this.version}`);
            return false;
          }
          break;
        }
        
        case 'force_current': {
          logger.Info(`Forcing current version ${this.version}`);
          // 清除其他版本的注册
          registry.clear();
          this.isRegistered = false;
          this.registerVersion();
          break;
        }
      }

      return true;
    } catch (error) {
      logger.Error("Failed to resolve version conflict:", error);
      return false;
    }
  }

  /**
   * 找到最新版本
   */
  private findLatestVersion(versions: VersionInfo[]): VersionInfo {
    return versions.reduce((latest, current) => {
      return this.compareVersions(current.version, latest.version) > 0 ? current : latest;
    });
  }

  /**
   * 找到最早版本
   */
  private findEarliestVersion(versions: VersionInfo[]): VersionInfo {
    return versions.reduce((earliest, current) => {
      return this.compareVersions(current.version, earliest.version) < 0 ? current : earliest;
    });
  }

  /**
   * 比较版本号
   * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const version1 = this.parseVersion(v1);
    const version2 = this.parseVersion(v2);

    if (version1.major !== version2.major) {
      return version1.major - version2.major;
    }
    if (version1.minor !== version2.minor) {
      return version1.minor - version2.minor;
    }
    return version1.patch - version2.patch;
  }

  /**
   * 生成版本冲突报告
   */
  public generateConflictReport(): {
    hasConflict: boolean;
    versions: VersionInfo[];
    recommendations: string[];
    resolutionStrategy: string;
  } {
    const registry = this.getGlobalVersionRegistry();
    const allVersions = Array.from(registry.values());
    const conflict = this.detectVersionConflicts();
    const strategy = this.getVersionResolutionStrategy();

    const recommendations: string[] = [];
    
    if (conflict) {
      recommendations.push(...conflict.getResolutionSuggestions());
    }

    recommendations.push(
      `Recommended strategy: ${strategy}`,
      "Use 'npm ls koatty_container' to check dependency tree",
      "Consider using package.json resolutions field to force version consistency"
    );

    return {
      hasConflict: !!conflict,
      versions: allVersions,
      recommendations,
      resolutionStrategy: strategy
    };
  }

  /**
   * 清理版本注册
   */
  public unregisterVersion(): void {
    if (!this.isRegistered) {
      return;
    }

    const registry = this.getGlobalVersionRegistry();
    registry.delete(this.instanceId);
    this.isRegistered = false;

    logger.Debug(`Unregistered koatty_container version ${this.version} (ID: ${this.instanceId})`);
  }

  /**
   * 获取当前版本信息
   */
  public getVersionInfo(): VersionInfo {
    return {
      version: this.version,
      timestamp: Date.now(),
      instanceId: this.instanceId,
      location: this.getModuleLocation()
    };
  }

  /**
   * 静态方法：快速检测全局版本冲突
   */
  public static quickConflictCheck(): boolean {
    if (!(<any>global)[VersionConflictDetector.GLOBAL_KEY]) {
      return false;
    }

    const registry = (<any>global)[VersionConflictDetector.GLOBAL_KEY] as Map<string, VersionInfo>;
    const versions = new Set(Array.from(registry.values()).map(v => v.version));
    
    return versions.size > 1;
  }

  /**
   * 静态方法：获取所有已注册的版本
   */
  public static getAllRegisteredVersions(): VersionInfo[] {
    if (!(<any>global)[VersionConflictDetector.GLOBAL_KEY]) {
      return [];
    }

    const registry = (<any>global)[VersionConflictDetector.GLOBAL_KEY] as Map<string, VersionInfo>;
    return Array.from(registry.values());
  }
} 