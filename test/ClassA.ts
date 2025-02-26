/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 10:35:23
 * @LastEditTime: 2025-02-26 15:27:15
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { AfterEach } from "../src/decorator/AOP";
import { Autowired } from "../src/decorator/Autowired";
import { Values } from "../src/decorator/Values";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";
import { Test3Aspect } from "./Test3Aspect";

@AfterEach(Test3Aspect)
export class ClassA {

  @Values(() => {
    return "dev";
  })
  config: string;

  @Autowired()
  protected readonly myDependency: MyDependency;

  @Autowired(MyDependency2)
  explicitDep?: MyDependency2;

  @Autowired()
  inferredDep!: MyDependency;

  run() {
    return this.myDependency.run();
  }

  async runTest() {
    return this.explicitDep?.run();
  }
}
