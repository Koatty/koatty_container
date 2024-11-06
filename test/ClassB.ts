/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 10:35:23
 * @LastEditTime: 2024-11-05 23:25:50
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { BeforeEach } from "../src/AOP";
import { Inject } from "../src/Autowired";
import { MyDependency2 } from "./MyDependency2";

@BeforeEach("Test2Aspect")
export class ClassB {

  protected readonly myDependency2: MyDependency2;

  constructor(@Inject("myDependency2") myDependency2: MyDependency2) {
    // Now `myDependency` can be used throughout the service.
  }

  run() {
    return this.myDependency2.run();
  }

}