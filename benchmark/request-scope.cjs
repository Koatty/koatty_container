// Execute source in an ordinary Node realm; Jest's VM adds host-call overhead.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
require('koatty_logger').DefaultLogger.enable(false);
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, experimentalDecorators: true },
}).outputText, file);
const { Container } = require('../src/container/container.ts');
function measure(fn) {
  for (let i = 0; i < 10000; i++) fn();
  const samples = [];
  for (let r = 0; r < 25; r++) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < 2000; i++) fn();
    samples.push(Number(process.hrtime.bigint() - start) / 2000 / 1000);
  }
  return samples.sort((a,b) => a-b)[12];
}
(async () => {
  class RequestBean { value = 1; }
  class SingletonBean { value = 1; }
  const c = new Container();
  c.reg(RequestBean, { scope: 'Request' }); c.reg(SingletonBean);
  const request = measure(() => c.runInRequestScope({}, () => c.get('RequestBean')));
  const singleton = measure(() => c.get('SingletonBean'));
  await c.clear();
  console.log(JSON.stringify({ node: process.version, request, singleton, unit: 'microseconds', samples: 25, operationsPerSample: 2000 }));
})();
