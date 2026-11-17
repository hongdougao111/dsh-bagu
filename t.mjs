import { updateOnce, dbStatus } from './lib/update.js';
const t0 = Date.now();
const r = await updateOnce({ onLog: (m) => console.log('  ' + m) });
console.log('\n结果:', JSON.stringify(r));
console.log('耗时:', ((Date.now() - t0) / 1000).toFixed(0) + 's');
console.log('之后:', JSON.stringify(dbStatus()));
