import { execFileSync } from 'child_process';
import path from 'path';

test('Request and Singleton resolution stay below 2µs in ordinary Node execution', () => {
  const output = execFileSync(process.execPath, [path.resolve(__dirname, '../../benchmark/request-scope.cjs')], { encoding: 'utf8' });
  const result = JSON.parse(output.trim().split('\n').find(line => line.startsWith('{'))!);
  console.log('[ARCH-02]', result);
  expect(result.request).toBeLessThan(2);
  expect(result.singleton).toBeLessThan(2);
});
