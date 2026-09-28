import ts from 'typescript';
import * as aop from '../../src/decorator/aop';
import { Container } from '../../src/container/container';
import { injectAOP } from '../../src/processor/aop_processor';

test.each([true, false])('SEC-01/AB-09 actual TS emit (experimentalDecorators=%s)', async legacy => {
  const suffix = legacy ? 'Legacy' : 'Standard';
  const source = `
    import { Aspect, Before, After, Around } from 'decorators';
    @Aspect() class Reject${suffix}Aspect { async run(){ throw new Error('denied'); } }
    @Aspect() class Post${suffix}Aspect { async run(args, proceed){ await proceed(); throw new Error('post failure'); } }
    @Aspect() class Result${suffix}Aspect { static result; async run(args, proceed, opts){ Result${suffix}Aspect.result = opts.result; } }
    export class Target${suffix} {
      calls = 0;
      @Before(Reject${suffix}Aspect) async rejected(){ return ++this.calls; }
      @Before(Reject${suffix}Aspect, { onError:'log' }) async tolerant(){ return ++this.calls; }
      @After(Result${suffix}Aspect) async observed(){ return 'result'; }
      @Around(Post${suffix}Aspect, { onError:'log' }) async once(){ return ++this.calls; }
    }
    export const Result = Result${suffix}Aspect;
  `;
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: legacy },
    reportDiagnostics: true,
  });
  expect(diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  const exports: any = {};
  new Function('require', 'exports', outputText)(() => aop, exports);
  const clazz = exports[`Target${suffix}`], instance = new clazz();
  injectAOP(clazz, Container.getInstance());
  await expect(instance.rejected()).rejects.toThrow('denied'); expect(instance.calls).toBe(0);
  expect(await instance.tolerant()).toBe(1);
  expect(await instance.observed()).toBe('result'); expect(exports.Result.result).toBe('result');
  expect(await instance.once()).toBe(2); expect(instance.calls).toBe(2);
});
