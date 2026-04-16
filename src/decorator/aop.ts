/**
 * @ author: richen
 * @ copyright: Copyright (c) - <richenlin(at)gmail.com>
 * @ license: BSD (3-Clause)
 * @ version: 2020-07-06 11:19:30
 */

import { Helper } from "koatty_lib";
import { IOC } from "../container/container";
import { AOPType, ClassOrString, TAGGED_AOP, TAGGED_CLS } from "../container/icontainer";

export const Aspect = (identifier?: string) => {
  return IOC.createDecorator((target: Function) => {
    if (!target.name.endsWith('Aspect')) {
      throw new Error("Aspect class names must use a suffix `Aspect`.");
    }
    if (!(target as any).prototype.run || typeof (target as any).prototype.run !== 'function') {
      throw new Error("The aspect class must implement the `run` method.");
    }
    IOC.saveClass("COMPONENT", target, identifier ?? target.name);
  }, 'class');
};

export const Before = <T>(aopName: ClassOrString<T>, options?: any) => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return IOC.createDecorator(({ target, methodName, descriptor, context }) => {
    if (context) {
      context.addInitializer(function (this: any) {
        IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
          type: AOPType.Before,
          name: aopName,
          method: methodName,
          options
        }, Object.getPrototypeOf(this));
      });
    } else {
      IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
        type: AOPType.Before,
        name: aopName,
        method: methodName,
        options
      }, target!);
      return descriptor;
    }
  }, 'method');
};

export const After = <T>(aopName: ClassOrString<T>, options?: any) => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return IOC.createDecorator(({ target, methodName, descriptor, context }) => {
    if (context) {
      context.addInitializer(function (this: any) {
        IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
          type: AOPType.After,
          name: aopName,
          method: methodName,
          options
        }, Object.getPrototypeOf(this));
      });
    } else {
      IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
        type: AOPType.After,
        name: aopName,
        method: methodName,
        options
      }, target!);
      return descriptor;
    }
  }, 'method');
};

export const Around = <T>(aopName: ClassOrString<T>, options?: any) => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return IOC.createDecorator(({ target, methodName, descriptor, context }) => {
    if (context) {
      context.addInitializer(function (this: any) {
        IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
          type: AOPType.Around,
          name: aopName,
          method: methodName,
          options
        }, Object.getPrototypeOf(this));
      });
    } else {
      IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
        type: AOPType.Around,
        name: aopName,
        method: methodName,
        options
      }, target!);
      return descriptor;
    }
  }, 'method');
};

export const BeforeEach = <T>(aopName: ClassOrString<T>, options?: any) => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return IOC.createDecorator((target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.BeforeEach,
      name: aopName,
      method: "*",
      options
    }, target);
  }, 'class');
};

export const AfterEach = <T>(aopName: ClassOrString<T>, options?: any) => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return IOC.createDecorator((target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AfterEach,
      name: aopName,
      method: "*",
      options
    }, target);
  }, 'class');
};

export const AroundEach = <T>(aopName: ClassOrString<T>, options?: any) => {
  if (!Helper.isString(aopName)) {
    aopName = (aopName as any)?.name;
  }
  if (!aopName) throw Error("AopName is required.");
  return IOC.createDecorator((target: Function) => {
    IOC.attachClassMetadata(TAGGED_CLS, TAGGED_AOP, {
      type: AOPType.AroundEach,
      name: aopName,
      method: "*",
      options
    }, target);
  }, 'class');
};

