import assert from "assert";
import { IOC } from "../src/Container";
import { Values } from "../src/Values";


describe("Values", () => {
  test("Values静态赋值", async () => {
    class TestClass {
      @Values("customId")
      config!: string;
    }
    IOC.reg(TestClass);
    const ins = IOC.get(TestClass);
    assert.equal(ins.config, "customId")
  })

  test("Values默认值", async () => {
    class TestClass2 {
      @Values("", "customId")
      config!: string;
    }
    IOC.reg(TestClass2);
    const ins = IOC.get(TestClass2);
    assert.equal(ins.config, "customId")
  })

  test("Values函数赋值", async () => {
    class TestClass3 {
      @Values(() => "dev")
      config!: string;
    }
    IOC.reg(TestClass3);
    const ins = IOC.get(TestClass3);
    assert.equal(ins.config, "dev")
  })
})