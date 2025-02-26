/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 10:35:23
 * @LastEditTime: 2025-02-26 17:46:01
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { After, Before } from "../src/decorator/AOP";
import { ClassA } from "./ClassA";
import { TestAspect } from "./TestAspect";

export class ClassC extends ClassA {
  name: string;
  constructor() {
    super();
    this.name = "ClassC.name";
  }

  __before() {
    console.log("__before");
  }

  __after() {
    console.log("__after");
  }

  run() {
    return this.myDependency.run();
  }

  @Before(TestAspect)
  run2(event: string) {
    return true;
  }

  @After(TestAspect)
  run3(event: string) {
    return true;
  }
}