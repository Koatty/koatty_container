/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: MIT
 * @ version: 2020-05-10 11:31:10
 */

import { Container } from './Container';

export { Autowired } from "./Autowired";
export * from "./Container";
export * from "./IContainer";
// export Singleton
export const IOCContainer: Container = Container.getInstance();