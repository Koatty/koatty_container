import { execFileSync } from 'child_process';
import path from 'path';

test('Request and Singleton resolution stay below 2µs in ordinary Node execution', () => {
  const output = execFileSync(process.execPath, [path.resolve(__dirname, '../../benchmark/request-scope.cjs')], { encoding: 'utf8' });
  const result = JSON.parse(output.trim().split('\n').find(line => line.startsWith('{'))!);
  console.log('[ARCH-02]', result);
  // Shared CI runners oversubscribe cores; keep the local budget strict and
  // allow an order-of-magnitude margin there until §12.3 benchmark gates land.
  const budgetMicros = process.env.CI ? 8 : 2;
  expect(result.request).toBeLessThan(budgetMicros);
  expect(result.singleton).toBeLessThan(budgetMicros);
});
