import { createGardenServer } from './app.mjs';
const port = Number(process.env.GARDEN_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid GARDEN_PORT');
const app = createGardenServer({ dataDir: process.env.GARDEN_DATA_DIR, origin: process.env.GARDEN_ORIGIN || 'https://ymihh.xyz', port });
await app.start();
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await app.stop(); process.exit(0); });
