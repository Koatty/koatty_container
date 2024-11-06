/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 10:35:23
 * @LastEditTime: 2024-11-06 11:52:18
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { AfterEach } from "../src/AOP";
import { Autowired } from "../src/Autowired";
import { Values } from "../src/Values";
import { MyDependency } from "./MyDependency";

@AfterEach("Test3Aspect")
export class ClassA {

  @Values(() => {
    return "dev";
  })
  config: string;

  @Autowired()
  protected readonly myDependency: MyDependency;

  run() {
    return this.myDependency.run();
  }

}