/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */
export * from "./container/container";
export * from "./container/icontainer";
export * from "./decorator/aop";
export * from "./decorator/autowired";
export * from "./decorator/component";
export * from "./decorator/values";
export * from "./utils/opertor";
export * from "./manager/index";
// Export performance optimization and utility classes
// export { MetadataCache } from "./utils/cache";
// export { CircularDepDetector, CircularDepError } from "./utils/circular";

// Export enhanced AOP types (interfaces with AspectContext support)
export type { AspectContext, IAspect } from "./container/icontainer";
