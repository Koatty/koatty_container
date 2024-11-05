import assert from "assert";
import { IOC } from "../src/Container";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";


describe("IOC", () => {
  beforeAll(() => {
    IOC.reg(MyDependency);
    IOC.reg(MyDependency2);
    IOC.reg("ClassA", ClassA);
    IOC.reg("ClassB", ClassB);
  })
  it("Autowired", async () => {
    const ins: ClassA = IOC.get("ClassA");
    assert.equal(ins.run(), "MyDependency.run");

  })

  it("Inject", async () => {
    const ins: ClassB = IOC.get("ClassB");
    assert.notEqual(ins.run(), "MyDependency2.run");
  })

})