// Carregar variáveis do .env.local se existir
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

module.exports = {
  apps: [
    {
      name: 'quaddra-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/quaddra/apps/web',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Variáveis do GitHub (carregadas do .env.local ou valores padrão)
        GITHUB_TOKEN: envVars.GITHUB_TOKEN || '',
        GITHUB_OWNER: envVars.GITHUB_OWNER || '4isaque4',
        GITHUB_REPO_QUADDRA: envVars.GITHUB_REPO_QUADDRA || 'vale-shope-processos',
        GITHUB_REPO_VALESHOP: envVars.GITHUB_REPO_VALESHOP || 'vale-shope-processos',
        GITHUB_BRANCH: envVars.GITHUB_BRANCH || 'main',
      },
      error_file: '/var/log/pm2/quaddra-web-error.log',
      out_file: '/var/log/pm2/quaddra-web-out.log',
      time: true,
    },
  ],
};
