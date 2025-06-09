/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 10:35:23
 * @LastEditTime: 2025-02-26 15:27:30
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { BeforeEach } from "../src/decorator/aop";
import { Inject } from "../src/decorator/Autowired";
import { MyDependency2 } from "./MyDependency2";
import { Test2Aspect } from "./Test2Aspect";

@BeforeEach(Test2Aspect)
export class ClassB {

  protected readonly myDependency2: MyDependency2;

  constructor(@Inject(MyDependency2) myDependency2: MyDependency2) {
    this.myDependency2 = myDependency2;
  }

  run() {
    return this.myDependency2.run();
  }

}