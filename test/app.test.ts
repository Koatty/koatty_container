/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-11-06 10:17:13
 * @LastEditTime: 2024-11-06 10:24:44
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import assert from "assert";
import { DefaultApp } from "../src/Application";


describe("Application", () => {
  test("setMetaData", async () => {
    const app = new DefaultApp();
    expect(() => app.setMetaData("test", 1)).not.toThrow();
  })
  test("getMetaData", async () => {
    const app = new DefaultApp();
    app.setMetaData("test", 1);
    assert.equal(app.getMetaData("test")[0], 1)
  })
})