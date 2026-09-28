import { createServer } from 'node:http';
import next from 'next';
import { loadEnvConfig } from '@next/env';
import { createWorldSocket } from './src/lib/world-socket';

async function main() {
  const dev = process.env.NODE_ENV !== 'production';
  loadEnvConfig(process.cwd(), dev);
  const args = process.argv.slice(2);
  const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const port = Number(option('--port') ?? option('-p') ?? process.env.PORT ?? 3000);
  const hostname = option('--hostname') ?? process.env.HOST ?? '0.0.0.0';
  // HTTP joins and WebSocket updates share the exact same in-memory world.
  const { POST } = await import('./src/app/api/world/route');
  const { world, saveAwardsBackground } = await import('./src/lib/world-runtime');
  const app = next({ dev, hostname, port });
  await app.prepare();
  const handle = app.getRequestHandler();
  const wss = createWorldSocket(world, saveAwardsBackground);
  const server = createServer(async (req, res) => {
    if (req.url?.split('?')[0] !== '/api/world') { await handle(req, res); return; }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2048) { res.writeHead(413).end(); return; }
        chunks.push(Buffer.from(chunk));
      }
      const response = await POST(new Request(`http://localhost:${port}/api/world`, {
        method: 'POST', body: Buffer.concat(chunks).toString(), headers: { 'Content-Type': 'application/json' },
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch (error) {
      console.error('World request failed', error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.split('?')[0] === '/api/world/socket') {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    }
    // Next registers its own development/HMR upgrade handler on first request.
  });
  server.listen(port, hostname, () => console.log(`> Game server ready on http://${hostname}:${port}`));
  const shutdown = () => {
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    server.close();
    void app.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
