/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-05 22:52:59
 * @LastEditTime: 2024-11-05 23:25:31
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { IAspect } from "koatty_container";
import { Aspect } from "../src/AOP";

@Aspect()
export class TestAspect implements IAspect {
  app: any;
  run(event: string): Promise<any> {
    console.log(event);
    return Promise.resolve();
  }
}