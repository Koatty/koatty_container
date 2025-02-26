import assert from "assert";
import { IOC } from "../src/Container";
import { ClassA } from "./ClassA";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";


describe("Container", () => {
  beforeAll(() => {
    IOC.reg(MyDependency);
    IOC.reg(MyDependency2);
    IOC.reg("ClassA", ClassA);
  })

  test("SetOrGetApp", () => {
    const app = Object.create(null);
    app.env = "production";
    IOC.setApp(app);

    assert.equal(IOC.getApp().env, "production")
  })

  test("getInsByClass", async () => {
    const ins = IOC.getInsByClass(ClassA);
    expect(ins).toBeInstanceOf(ClassA);
  })

  test("getIdentifier", async () => {
    const id = IOC.getIdentifier(ClassA)
    assert.equal(id, "ClassA")
  })

  test("getType", async () => {
    const id = IOC.getType(ClassA)
    assert.equal(id, "COMPONENT")
  })

})