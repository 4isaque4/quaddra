import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import FastifyStatic from '@fastify/static';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT || 4000);
const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

// Serve arquivos estáticos (BPMN e JSONs) a partir de storage/
const storageDir = join(__dirname, '..', 'storage');
await server.register(FastifyStatic, {
  root: storageDir,
  prefix: '/storage/',
});

// util: ler diretório BPMN
const bpmnDir = join(storageDir, 'bpmn');

async function listBpmnFiles() {
  try {
    const files = await fs.readdir(bpmnDir);
    return files.filter(f => f.toLowerCase().endsWith('.bpmn'));
  } catch {
    return [];
  }
}

// GET /api/health
server.get('/api/health', async () => ({ ok: true }));

// GET /api/processes  -> lista de processos a partir dos arquivos .bpmn
server.get('/api/processes', async () => {
  const files = await listBpmnFiles();
  // slug = nome do arquivo sem extensão com espaços->-
  const items = files.map(f => ({
    file: f,
    slug: f.replace(/\.bpmn$/i, '').replace(/\s+/g, '-'),
    bpmnUrl: `/api/processes/${encodeURIComponent(f.replace(/\.bpmn$/i, '').replace(/\s+/g, '-'))}/bpmn`,
    descriptionsUrl: `/api/processes/${encodeURIComponent(f.replace(/\.bpmn$/i, '').replace(/\s+/g, '-'))}/descriptions`
  }));
  return { items };
});

function fileFromSlug(slug: string) {
  // tenta reverter slug -> nome de arquivo (substitui '-' por ' ')
  // e verifica existência
  const candidates = [
    slug.replace(/-/g, ' ') + '.bpmn',
    slug + '.bpmn'
  ];
  return candidates;
}

// GET /api/processes/:slug/bpmn -> retorna XML
server.get('/api/processes/:slug/bpmn', async (req, reply) => {
  const slug = (req.params as any).slug as string;
  const candidates = fileFromSlug(slug);
  for (const c of candidates) {
    const p = join(bpmnDir, c);
    try {
      const xml = await fs.readFile(p, 'utf8');
      reply.type('application/xml').send(xml);
      return;
    } catch {}
  }
  reply.code(404).send({ error: 'BPMN not found for slug ' + slug });
});

// GET /api/processes/:slug/descriptions -> lê JSONs gerados pelo extractor e filtra pelo arquivo
server.get('/api/processes/:slug/descriptions', async (req, reply) => {
  const slug = (req.params as any).slug as string;
  const advPath = join(storageDir, 'descriptions.advanced.json');
  const flatPath = join(storageDir, 'descriptions.flat.json');
  let adv: any = null, flat: any = null;
  try { adv = JSON.parse(await fs.readFile(advPath, 'utf8')); } catch {}
  try { flat = JSON.parse(await fs.readFile(flatPath, 'utf8')); } catch {}

  if (!adv && !flat) {
    reply.code(404).send({ error: 'No description JSON found. Run npm run extract.' });
    return;
  }

  // tenta mapear slug->arquivo
  const candidates = fileFromSlug(slug);
  const files = await listBpmnFiles();
  const match = candidates.find(c => files.includes(c));

  if (adv && match && adv[match]) {
    return adv[match];
  }
  if (flat) {
    // fallback: devolve flat inteiro
    return flat;
  }
  reply.code(404).send({ error: 'No descriptions for slug ' + slug });
});

server.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log('API listening on', PORT);
}).catch(err => {
  server.log.error(err);
  process.exit(1);
});
