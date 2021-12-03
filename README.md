# koatty_container
IOC Container for Koatty!

## IOC容器

IoC全称Inversion of Control，直译为控制反转。在以ES6 Class范式编程中，简单的通过new创建实例并持有的方式，会发现以下缺点：

* 实例化一个组件，要先实例化依赖的组件，强耦合

* 每个组件都需要实例化一个依赖组件，没有复用

* 很多组件需要销毁以便释放资源，例如DataSource，但如果该组件被多个组件共享，如何确保它的使用方都已经全部被销毁

* 随着更多的组件被引入，需要共享的组件写起来会更困难，这些组件的依赖关系会越来越复杂


如果一个系统有大量的组件，其生命周期和相互之间的依赖关系如果由组件自身来维护，不但大大增加了系统的复杂度，而且会导致组件之间极为紧密的耦合，继而给测试和维护带来了极大的困难。

因此，核心问题是：

- 1、谁负责创建组件？
- 2、谁负责根据依赖关系组装组件？
- 3、销毁时，如何按依赖顺序正确销毁？

解决这一问题的核心方案就是IoC。参考Spring IOC的实现机制，Koatty实现了一个IOC容器（koatty_container），在应用启动的时候，自动分类装载组件，并且根据依赖关系，注入相应的依赖。因此，IoC又称为依赖注入（DI：Dependency Injection），它解决了一个最主要的问题：将组件的创建+配置与组件的使用相分离，并且，由IoC容器负责管理组件的生命周期。

### 组件分类

根据组件的不同应用场景，Koatty把Bean分为 'COMPONENT' | 'CONTROLLER' | 'MIDDLEWARE' | 'SERVICE' 四种类型。

* COMPONENT
  扩展类、第三方类属于此类型，例如 Plugin，ORM持久层等

* CONTROLLER
  控制器类

* MIDDLEWARE
  中间件类

* SERVICE
  逻辑服务类

### 组件加载

通过Koatty框架核心的Loader，在项目启动时，会自动分析并装配Bean，自动处理好Bean之间的依赖问题。IOC容器提供了一系列的，方便注册以及获取装配好的Bean。

## AOP切面

Koatty基于IOC容器实现了一套切面编程机制，利用装饰器以及内置特殊方法，在bean装载到IOC容器内的时候，通过嵌套函数的原理进行封装，简单而且高效。

### 切点声明类型

通过@Before、@After、@BeforeEach、@AfterEach装饰器声明的切点



| 声明方式     | 依赖Aspect切面类 | 能否使用类作用域 | 入参依赖切点方法 |
| ------------ | ---------------- | ---------------- | ---------------- |
| 装饰器声明   | 依赖             | 不能             | 依赖             |

依赖Aspect切面类： 需要创建对应的Aspect切面类才能使用

能否使用类作用域： 能不能使用切点所在类的this指针

入参依赖切点方法： 装饰器声明切点所在方法的入参同切面共享

例如: 

```js
@Controller('/')
export class TestController extends BaseController {
  app: App;
  ctx: KoattyContext;

  @Autowired()
  protected TestService: TestService;
  
  @Before(TestAspect) //依赖TestAspect切面类, 能够获取path参数
  async test(path: string){

  }
}

```

### 创建切面类

使用`koatty_cli`进行创建：

```bash
koatty aspect test
```

自动生成的模板代码:

```js 
import { Aspect } from "koatty";
import { App } from '../App';

@Aspect()
export class TestAspect {
    app: App;

    run() {
        console.log('TestAspect');
    }
}
```
