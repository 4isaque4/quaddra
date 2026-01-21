#!/bin/bash

# ============================================
# Script de Deploy Estático - Quaddra
# Para hospedagem sem Node.js (Hostnet)
# ============================================

set -e  # Sair em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Deploy Estático - Quaddra        ║${NC}"
echo -e "${BLUE}║   Para VPS (Nginx)                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
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
rm -rf apps/web/out
rm -rf deploy-static

# Instalar dependências
echo -e "${BLUE}📦 Instalando dependências...${NC}"
npm install

# Build do frontend estático
echo -e "${BLUE}🔨 Fazendo build estático do Next.js...${NC}"
cd apps/web
npm run build
cd ../..

# Extrair descrições BPMN
echo -e "${BLUE}📝 Extraindo descrições BPMN...${NC}"
npm run extract-bpmn

# Criar estrutura de deploy estático
echo -e "${BLUE}📁 Criando estrutura de deploy estático...${NC}"
mkdir -p deploy-static

# Copiar arquivos estáticos do Next.js
echo -e "${BLUE}📋 Copiando arquivos estáticos...${NC}"
cp -r apps/web/out/* deploy-static/

# Criar pasta para API externa
mkdir -p deploy-static/api-data

# Copiar dados da API (BPMN e JSONs)
echo -e "${BLUE}📋 Copiando dados da API...${NC}"
cp -r apps/api/storage/* deploy-static/api-data/

# Copiar configurações
echo -e "${BLUE}⚙️  Copiando configurações...${NC}"
cp .htaccess deploy-static/

# Criar arquivo de configuração para API externa
cat > deploy-static/api-config.json << EOF
{
  "apiUrl": "https://api.quaddract.com.br",
  "fallbackUrl": "https://quaddract.com.br/api-data",
  "version": "1.0.0",
  "lastUpdate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Criar arquivo de instruções
cat > deploy-static/INSTRUCOES_DEPLOY_ESTATICO.txt << 'EOF'
╔════════════════════════════════════════════════════════════╗
║     INSTRUÇÕES DE DEPLOY ESTÁTICO - QUADDRA               ║
║           Para Hospedagem sem Node.js                     ║
╚════════════════════════════════════════════════════════════╝

📦 DEPLOY ESTÁTICO (SEM NODE.JS)

Esta versão funciona apenas com arquivos estáticos (HTML, CSS, JS).

╔════════════════════════════════════════════════════════════╗
║  PASSO 1: UPLOAD DOS ARQUIVOS                              ║
╚════════════════════════════════════════════════════════════╝

1. Faça upload de TODOS os arquivos desta pasta para /public_html/
2. Mantenha a estrutura de pastas intacta
3. O arquivo .htaccess já está incluído

╔════════════════════════════════════════════════════════════╗
║  PASSO 2: CONFIGURAR API EXTERNA                           ║
╚════════════════════════════════════════════════════════════╝

Para que os processos BPMN funcionem, você precisa de uma API externa:

OPÇÃO A: Deploy da API em outro servidor com Node.js
- Vercel, Netlify, Railway, Heroku, etc.
- Use os arquivos em /api-data/ como dados

OPÇÃO B: Usar dados locais (funcionalidade limitada)
- Os arquivos BPMN estão em /api-data/
- Funciona apenas para visualização estática

OPÇÃO C: Configurar subdomínio da API
- Crie api.quaddract.com.br
- Deploy da API Node.js no subdomínio

╔════════════════════════════════════════════════════════════╗
║  PASSO 3: TESTAR                                           ║
╚════════════════════════════════════════════════════════════╝

- Frontend: https://quaddract.com.br/
- Processos: https://quaddract.com.br/processos/
- API Data: https://quaddract.com.br/api-data/

╔════════════════════════════════════════════════════════════╗
║  LIMITAÇÕES DO DEPLOY ESTÁTICO                             ║
╚════════════════════════════════════════════════════════════╝

❌ Não funciona:
- API dinâmica (/api/* endpoints)
- Processamento de BPMN em tempo real
- Funcionalidades que precisam de servidor

✅ Funciona:
- Interface visual
- Navegação
- Visualização de conteúdo estático
- Design responsivo

╔════════════════════════════════════════════════════════════╗
║  RECOMENDAÇÃO                                              ║
╚════════════════════════════════════════════════════════════╝

Para funcionalidade completa, considere:
1. Hospedagem com suporte Node.js (Vercel, Netlify)
2. Deploy da API em serviço separado
3. Upgrade do plano da Hostnet para incluir Node.js

EOF

# Comprimir para upload
echo -e "${BLUE}📦 Comprimindo arquivos para upload...${NC}"
cd deploy-static
zip -r ../quaddra-deploy-static.zip . -q
cd ..

echo ""
echo -e "${GREEN}✅ Deploy estático preparado com sucesso!${NC}"
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  📁 ARQUIVOS PRONTOS PARA UPLOAD      ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 ${BLUE}quaddra-deploy-static.zip${NC} - Arquivo estático"
echo -e "📁 ${BLUE}deploy-static/${NC} - Pasta com arquivos estáticos"
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  ⚠️  IMPORTANTE - LIMITAÇÕES           ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "❌ ${RED}Esta versão NÃO inclui API dinâmica${NC}"
echo -e "❌ ${RED}Processos BPMN podem não funcionar completamente${NC}"
echo -e "✅ ${GREEN}Interface visual funcionará normalmente${NC}"
echo ""
echo -e "${BLUE}💡 Para funcionalidade completa, use deploy completo${NC}"
echo -e "${BLUE}🔗 Documentação: README_DEPLOY.md${NC}"
echo ""
