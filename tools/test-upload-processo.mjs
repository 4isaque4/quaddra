/**
 * Script para testar o envio de todas as pastas e arquivos BPMN para a API de upload.
 * Uso: node tools/test-upload-processo.mjs
 * Requer: servidor web rodando (npm run dev) e Node 20+ (para File em FormData).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BPMN_ROOT = join(ROOT, 'apps', 'api', 'storage', 'bpmn');

const BASE_URL = process.env.UPLOAD_TEST_URL || 'http://localhost:3000';
const CLIENT_TYPE = 'valeshop';
const FORCE_UPLOAD = process.env.FORCE_UPLOAD === '1' || process.argv.includes('--force');

/**
 * Descobre todos os .bpmn recursivamente e agrupa por pasta (caminho relativo à BPMN_ROOT).
 * Retorna Map<caminhoPasta, string[] nomes dos arquivos>.
 */
function discoverAllBpmnByFolder(rootDir, baseDir = rootDir, acc = new Map()) {
  if (!existsSync(rootDir)) return acc;
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(rootDir, e.name);
    if (e.isDirectory()) {
      discoverAllBpmnByFolder(full, baseDir, acc);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.bpmn')) {
      const folderPath = relative(baseDir, dirname(full)).replace(/\\/g, '/');
      const folderKey = folderPath || 'root';
      if (!acc.has(folderKey)) acc.set(folderKey, []);
      acc.get(folderKey).push(e.name);
    }
  }
  return acc;
}

function buildFormData(processName, folderPath, filePaths, forceUpload = false) {
  const formData = new FormData();
  formData.append('processName', processName);
  formData.append('clientType', CLIENT_TYPE);
  if (forceUpload) formData.append('forceUpload', '1');

  const normalizedPath = folderPath.replace(/\\/g, '/').trim();
  formData.append(
    'folderStructure',
    JSON.stringify([{ path: normalizedPath, name: normalizedPath, fileCount: filePaths.length }])
  );

  for (const relativePath of filePaths) {
    const fullPath =
      folderPath === 'root' ? join(BPMN_ROOT, relativePath) : join(BPMN_ROOT, folderPath, relativePath);
    if (!existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado: ${fullPath}`);
    }
    const buffer = readFileSync(fullPath);
    const file = new File([buffer], relativePath, { type: 'application/xml' });
    formData.append(`folder_${normalizedPath}`, file);
  }

  return formData;
}

async function main() {
  console.log('Teste de upload de processos (todos os .bpmn em storage/bpmn)');
  console.log('Base URL:', BASE_URL);
  console.log('Pasta BPMN:', BPMN_ROOT);
  if (FORCE_UPLOAD) console.log('Modo: FORÇAR ENVIO (sempre fazer commit)');
  console.log('');

  if (!existsSync(BPMN_ROOT)) {
    console.error('Pasta de BPMN não encontrada:', BPMN_ROOT);
    process.exit(1);
  }

  const pastasMap = discoverAllBpmnByFolder(BPMN_ROOT);
  const pastas = Array.from(pastasMap.entries())
    .map(([path, files]) => ({ path: path === 'root' ? '' : path, files }))
    .filter((p) => p.files.length > 0)
    .sort((a, b) => (a.path || '').localeCompare(b.path || ''));

  if (pastas.length === 0) {
    console.log('Nenhum arquivo .bpmn encontrado em', BPMN_ROOT);
    process.exit(0);
  }

  const totalArquivos = pastas.reduce((s, p) => s + p.files.length, 0);
  console.log(`Pastas encontradas: ${pastas.length} (${totalArquivos} arquivo(s) no total)\n`);

  const processName =
    pastas[0].path && pastas[0].path.includes('/')
      ? pastas[0].path.split('/')[0]
      : pastas[0].path || 'Processos';

  let totalOk = 0;
  let totalNoCommit = 0;
  let totalErr = 0;

  for (const pasta of pastas) {
    const folderPath = pasta.path || 'root';
    const fullPaths =
      folderPath === 'root'
        ? pasta.files.map((f) => join(BPMN_ROOT, f))
        : pasta.files.map((f) => join(BPMN_ROOT, folderPath, f));
    const missing = fullPaths.filter((p) => !existsSync(p));
    if (missing.length) {
      console.error(`Pasta "${folderPath}": arquivos não encontrados:`, missing);
      totalErr++;
      continue;
    }

    const formData = buildFormData(processName, folderPath, pasta.files, FORCE_UPLOAD);
    const label = folderPath === 'root' ? '(raiz)' : folderPath;
    console.log(`Enviando: ${label} (${pasta.files.length} arquivo(s))`);

    try {
      const res = await fetch(`${BASE_URL}/api/upload-processo`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error(`  Erro ${res.status}:`, data.error || data.details || res.statusText);
        totalErr++;
        continue;
      }

      if (data.noCommit) {
        console.log('  -> Nenhum commit necessário (arquivos iguais ao repo)');
        totalNoCommit++;
      } else if (data.githubSynced) {
        console.log('  -> OK, sincronizado com GitHub');
        totalOk++;
      } else {
        console.log('  -> Resposta:', data.message || data);
        if (data.githubError) console.log('     GitHub:', data.githubError);
        totalOk++;
      }
    } catch (err) {
      console.error('  Exceção:', err.message);
      if (err.cause?.code === 'ECONNREFUSED') {
        console.error('\nServidor não está rodando. Execute: npm run dev');
      }
      totalErr++;
    }
  }

  console.log('');
  console.log('Resumo:', { enviados: totalOk + totalNoCommit, commitados: totalOk, semCommit: totalNoCommit, erros: totalErr });
  process.exit(totalErr > 0 ? 1 : 0);
}

main();
