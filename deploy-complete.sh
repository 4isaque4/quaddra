#!/bin/bash

# ============================================
# Script de Deploy Completo - Quaddra
# ============================================

set -e  # Sair em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Deploy Quaddra - VPS              ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo -e "${YELLOW}📋 Por favor, crie o arquivo .env baseado no env.example${NC}"
    exit 1
fi

# Carregar variáveis de ambiente
echo -e "${BLUE}📦 Carregando variáveis de ambiente...${NC}"
export $(cat .env | grep -v '^#' | xargs)

# Limpar builds anteriores
echo -e "${BLUE}🧹 Limpando builds anteriores...${NC}"
rm -rf apps/web/.next
rm -rf apps/api/dist
rm -rf deploy-files

# Instalar dependências
echo -e "${BLUE}📦 Instalando dependências...${NC}"
npm install

# Build do projeto
echo -e "${BLUE}🔨 Fazendo build do projeto...${NC}"
npm run build

# Extrair descrições BPMN
echo -e "${BLUE}📝 Extraindo descrições BPMN...${NC}"
npm run extract-bpmn

# Criar estrutura de deploy
echo -e "${BLUE}📁 Criando estrutura de deploy...${NC}"
mkdir -p deploy-files/api
mkdir -p deploy-files/web

# Copiar arquivos da API
echo -e "${BLUE}📋 Copiando arquivos da API...${NC}"
cp -r apps/api/dist deploy-files/api/
cp -r apps/api/storage deploy-files/api/
cp apps/api/package.json deploy-files/api/
cp apps/api/ecosystem.config.js deploy-files/api/

# Copiar arquivos do Web (Next.js standalone)
echo -e "${BLUE}📋 Copiando arquivos do Web...${NC}"
cp -r apps/web/.next/standalone/* deploy-files/web/
cp -r apps/web/.next/static deploy-files/web/.next/
cp -r apps/web/public deploy-files/web/ 2>/dev/null || true

# Copiar configurações
echo -e "${BLUE}⚙️  Copiando configurações...${NC}"
cp .htaccess deploy-files/
cp .env deploy-files/

# Criar arquivo de instruções
cat > deploy-files/INSTRUCOES_DEPLOY.txt << 'EOF'
╔════════════════════════════════════════════════════════════╗
║          INSTRUÇÕES DE DEPLOY - QUADDRA                    ║
╚════════════════════════════════════════════════════════════╝

📦 ARQUIVOS PREPARADOS PARA UPLOAD

Esta pasta contém todos os arquivos necessários para o deploy.

╔════════════════════════════════════════════════════════════╗
║  PASSO 1: UPLOAD DOS ARQUIVOS                              ║
╚════════════════════════════════════════════════════════════╝

Via FTP/SFTP ou Painel da Hostnet:

1. Acesse seu servidor FTP
2. Faça upload da pasta 'web' para: /public_html/
3. Faça upload da pasta 'api' para: /public_html/api/
4. Faça upload do arquivo .htaccess para: /public_html/
5. Faça upload do arquivo .env para: /public_html/

╔════════════════════════════════════════════════════════════╗
║  PASSO 2: CONFIGURAR NODE.JS NA HOSTNET                    ║
╚════════════════════════════════════════════════════════════╝

No Painel de Controle da Hostnet:

APLICAÇÃO WEB (Frontend):
- Nome: Quaddra Web
- Versão Node.js: 18.x ou superior
- Pasta raiz: /public_html/web
- Arquivo de entrada: apps/web/server.js
- Porta: 3000
- Modo: Production

APLICAÇÃO API (Backend):
- Nome: Quaddra API
- Versão Node.js: 18.x ou superior  
- Pasta raiz: /public_html/api
- Arquivo de entrada: dist/index.js
- Porta: 4000
- Modo: Production

OU usar PM2 (se disponível):
cd /public_html/api
npm install pm2 -g
pm2 start ecosystem.config.js
pm2 save
pm2 startup

╔════════════════════════════════════════════════════════════╗
║  PASSO 3: INSTALAR DEPENDÊNCIAS NO SERVIDOR                ║
╚════════════════════════════════════════════════════════════╝

Via SSH (se disponível):

cd /public_html/web
npm install --production

cd /public_html/api
npm install --production

╔════════════════════════════════════════════════════════════╗
║  PASSO 4: VERIFICAR VARIÁVEIS DE AMBIENTE                  ║
╚════════════════════════════════════════════════════════════╝

Edite o arquivo .env no servidor e configure:

NEXT_PUBLIC_API_URL=https://seudominio.com.br
NODE_ENV=production
PORT=4000

╔════════════════════════════════════════════════════════════╗
║  PASSO 5: INICIAR APLICAÇÕES                               ║
╚════════════════════════════════════════════════════════════╝

No Painel da Hostnet:
- Vá em "Aplicações Node.js"
- Clique em "Iniciar" para cada aplicação

Ou via SSH:
cd /public_html/web
npm start &

cd /public_html/api
npm start &

╔════════════════════════════════════════════════════════════╗
║  PASSO 6: TESTAR                                           ║
╚════════════════════════════════════════════════════════════╝

Execute o script de verificação:
bash verify-deploy.sh quaddract.com.br

Ou teste manualmente:
- Frontend: https://quaddract.com.br
- API Health: https://quaddract.com.br/api/health
- Processos: https://quaddract.com.br/processos

╔════════════════════════════════════════════════════════════╗
║  TROUBLESHOOTING                                           ║
╚════════════════════════════════════════════════════════════╝

❌ Erro: "Cannot find module"
   → Execute npm install --production no servidor

❌ Erro: "Port already in use"
   → Verifique se já existe processo rodando na porta
   → Use: pm2 list ou ps aux | grep node

❌ Erro: "API not responding"
   → Verifique logs: pm2 logs ou painel da Hostnet
   → Confirme que a porta 4000 está aberta
   → Verifique .env está configurado corretamente

❌ Frontend não carrega:
   → Verifique se o build foi feito corretamente
   → Confirme NEXT_PUBLIC_API_URL no .env
   → Verifique logs de erro no console do navegador

╔════════════════════════════════════════════════════════════╗
║  SUPORTE                                                   ║
╚════════════════════════════════════════════════════════════╝

- Hostnet: https://suporte.hostnet.com.br
- Logs Web: Painel → Aplicações → Logs
- Logs API: pm2 logs quaddra-api

EOF

# Criar arquivo package.json para o deploy
cat > deploy-files/package.json << 'EOF'
{
  "name": "quaddra-deploy",
  "version": "1.0.0",
  "description": "Quaddra - Sistema de Processos BPMN",
  "private": true,
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "start:web": "cd web && npm start",
    "start:api": "cd api && npm start",
    "install:all": "cd web && npm install --production && cd ../api && npm install --production"
  }
}
EOF

# Comprimir para upload
echo -e "${BLUE}📦 Comprimindo arquivos para upload...${NC}"
cd deploy-files
zip -r ../quaddra-deploy.zip . -q
cd ..

echo ""
echo -e "${GREEN}✅ Deploy preparado com sucesso!${NC}"
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  📁 ARQUIVOS PRONTOS PARA UPLOAD      ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 ${BLUE}quaddra-deploy.zip${NC} - Arquivo compactado com tudo"
echo -e "📁 ${BLUE}deploy-files/${NC} - Pasta com arquivos organizados"
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  📋 PRÓXIMOS PASSOS                   ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "1. ${GREEN}✓${NC} Faça upload do arquivo ${BLUE}quaddra-deploy.zip${NC} para o servidor"
echo -e "2. ${GREEN}✓${NC} Descompacte no diretório ${BLUE}/public_html/${NC}"
echo -e "3. ${GREEN}✓${NC} Leia o arquivo ${BLUE}INSTRUCOES_DEPLOY.txt${NC}"
echo -e "4. ${GREEN}✓${NC} Configure as aplicações Node.js no painel"
echo -e "5. ${GREEN}✓${NC} Execute ${BLUE}verify-deploy.sh${NC} para verificar"
echo ""
echo -e "${BLUE}🔗 Documentação completa: README_DEPLOY.md${NC}"
echo ""

