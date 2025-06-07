/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { IOC } from "../src/container/Container";
import { ClassA } from "./ClassA";
import { ClassB } from "./ClassB";
import { ClassC } from "./ClassC";
import { ClassD } from "./ClassD";
import { ClassE } from "./ClassE";
import { ClassF, ClassFWithEach, ClassG } from "./ClassF";
import { TestAspect } from "./TestAspect";
import { Test2Aspect } from "./Test2Aspect";
import { Test3Aspect } from "./Test3Aspect";
import { AroundAspect } from "./AroundAspect";
import { OrderAspect } from "./OrderAspect";
import { ParameterModifyAspect } from "./ParameterModifyAspect";
import { ReturnValueModifyAspect } from "./ReturnValueModifyAspect";
import { ErrorAspect } from "./ErrorAspect";
import { DuplicateMethodLevelTest, DuplicateClassLevelTest, PriorityTest } from "./DuplicateAOPTest";
import { MyDependency } from "./MyDependency";
import { MyDependency2 } from "./MyDependency2";

// Register dependency classes first
IOC.reg(MyDependency);
IOC.reg(MyDependency2);

// Register test classes
IOC.saveClass("COMPONENT", ClassA, "ClassA");
IOC.saveClass("COMPONENT", ClassB, "ClassB");
IOC.saveClass("COMPONENT", ClassC, "ClassC");
IOC.saveClass("COMPONENT", ClassD, "ClassD");
IOC.saveClass("COMPONENT", ClassE, "ClassE");
IOC.saveClass("COMPONENT", ClassF, "ClassF");
IOC.saveClass("COMPONENT", ClassFWithEach, "ClassFWithEach");
IOC.saveClass("COMPONENT", ClassG, "ClassG");

// Register duplicate test classes
IOC.saveClass("COMPONENT", DuplicateMethodLevelTest, "DuplicateMethodLevelTest");
IOC.saveClass("COMPONENT", DuplicateClassLevelTest, "DuplicateClassLevelTest");
IOC.saveClass("COMPONENT", PriorityTest, "PriorityTest");

// Register aspect classes
IOC.saveClass("COMPONENT", TestAspect, "TestAspect");
IOC.saveClass("COMPONENT", Test2Aspect, "Test2Aspect");
IOC.saveClass("COMPONENT", Test3Aspect, "Test3Aspect");
IOC.saveClass("COMPONENT", AroundAspect, "AroundAspect");
IOC.saveClass("COMPONENT", OrderAspect, "OrderAspect");
IOC.saveClass("COMPONENT", ParameterModifyAspect, "ParameterModifyAspect");
IOC.saveClass("COMPONENT", ReturnValueModifyAspect, "ReturnValueModifyAspect");
IOC.saveClass("COMPONENT", ErrorAspect, "ErrorAspect"); 