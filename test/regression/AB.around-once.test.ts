import { Container } from '../../src/container/container';
import { Aspect, Around } from '../../src/decorator/aop';
import { injectAOP } from '../../src/processor/aop_processor';
@Aspect()
class AuditPostAspect {
  async run(args:any[],proceed:Function) { await proceed(); throw new Error('after proceed'); }
}
@Aspect()
class AuditPreAspect { async run() { throw new Error('before proceed'); } }
class Legacy {
  calls=0;
  @Around(AuditPostAspect,{onError:'log'}) async work() { return ++this.calls; }
}
class Failing {
  calls=0;
  @Around(AuditPostAspect,{onError:'log'}) async work() { ++this.calls; throw new Error('business'); }
}
class Before {
  calls=0;
  @Around(AuditPreAspect,{onError:'log'}) async work() { return ++this.calls; }
}
const ioc=Container.getInstance();
beforeAll(()=>{ for(const c of [AuditPostAspect,AuditPreAspect,Legacy,Failing,Before]) ioc.saveClass('COMPONENT',c,c.name); });
test('AB-09 Legacy: post-proceed error returns the first business result',async()=>{
  const t:any=ioc.get('Legacy'); expect(await t.work()).toBe(1); expect(t.calls).toBe(1);
});
test('AB-09: business failure propagates without retry',async()=>{
  const t:any=ioc.get('Failing'); await expect(t.work()).rejects.toThrow('business'); expect(t.calls).toBe(1);
});
test('AB-09: pre-proceed log fallback executes once',async()=>{
  const t:any=ioc.get('Before'); expect(await t.work()).toBe(1); expect(t.calls).toBe(1);
});
test('AB-09 TC39: post-proceed error never repeats business',async()=>{
  class Standard { calls=0; async work(){ return ++this.calls; } }
  let init:Function;
  (Around as any)(AuditPostAspect,{onError:'log'})(Standard.prototype.work,{kind:'method',name:'work',static:false,private:false,addInitializer(f:Function){init=f;}});
  const t=new Standard(); init!.call(t); injectAOP(Standard,ioc);
  expect(await t.work()).toBe(1); expect(t.calls).toBe(1);
});
