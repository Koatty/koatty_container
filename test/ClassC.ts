/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 10:35:23
 * @LastEditTime: 2024-11-05 11:51:49
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { ClassA } from "./ClassA";

export class ClassC extends ClassA {

  run() {
    return this.myDependency.run();
  }
}