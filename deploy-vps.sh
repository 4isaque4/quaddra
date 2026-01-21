#!/bin/bash

# ============================================
# Script Automático de Deploy VPS - Quaddra
# Hostinger VPS + Domínio
# ============================================

set -e  # Sair em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
DOMAIN="quaddraconsultoria.com.br"
VPS_IP="82.29.60.183"
VPS_USER="root"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Deploy Automático VPS - Quaddra  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configurações:${NC}"
echo -e "  Domínio: ${GREEN}${DOMAIN}${NC}"
echo -e "  VPS IP: ${GREEN}${VPS_IP}${NC}"
echo -e "  Usuário: ${GREEN}${VPS_USER}${NC}"
echo ""

# Confirmar
read -p "Continuar com o deploy? (S/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "Deploy cancelado."
    exit 1
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  PASSO 1: Configurar servidor VPS     ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Conectar ao VPS e configurar
ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
    echo "🔄 Atualizando sistema..."
    sudo apt update && sudo apt upgrade -y
    
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install nodejs -y
    
    echo "📦 Instalando Nginx..."
    sudo apt install nginx -y
    
    echo "📦 Instalando PM2..."
    sudo npm install -g pm2
    
    echo "✅ Configuração básica concluída!"
ENDSSH

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  PASSO 2: Preparar arquivos locais    ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    echo "📝 Criando arquivo .env..."
    cat > .env << EOF
NEXT_PUBLIC_API_URL=https://${DOMAIN}
NODE_ENV=production
PORT=4000
EOF
fi

# Build local
echo "📦 Instalando dependências..."
npm install

echo "🔨 Fazendo build do projeto..."
cd apps/api
npm install
npm run build
cd ../web
npm install
cd ../..

echo "📝 Extraindo descrições BPMN..."
npm run extract-bpmn

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  PASSO 3: Enviar arquivos para VPS    ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Criar estrutura no VPS
ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
    mkdir -p /var/www/quaddra
    cd /var/www/quaddra
ENDSSH

# Enviar arquivos essenciais
echo "📤 Enviando arquivos do projeto..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude 'out' --exclude '.git' \
    ./ ${VPS_USER}@${VPS_IP}:/var/www/quaddra/

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  PASSO 4: Build e Iniciar no VPS      ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Build e iniciar no VPS
ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
    cd /var/www/quaddra
    
    echo "📦 Instalando dependências no VPS..."
    npm install
    
    echo "🔨 Fazendo build da API..."
    cd apps/api
    npm install
    npm run build
    cd ../..
    
    echo "🔨 Fazendo build do Frontend..."
    cd apps/web
    npm install
    npm run build
    cd ../..
    
    echo "🚀 Iniciando aplicações com PM2..."
    pm2 delete quaddra-api quaddra-web 2>/dev/null || true
    
    cd apps/api
    pm2 start ecosystem.config.js
    
    cd ../web
    pm2 start npm --name "quaddra-web" -- start
    
    pm2 save
    
    echo "✅ Aplicações iniciadas!"
    echo "⚠️  IMPORTANTE: Execute 'pm2 startup' e depois execute o comando mostrado na tela"
ENDSSH

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  PASSO 5: Configurar Nginx            ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Configurar Nginx
ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
    echo "⚙️ Configurando Nginx..."
    
    sudo tee /etc/nginx/sites-available/quaddra > /dev/null << 'EOF'
server {
    listen 80;
    server_name quaddraconsultoria.com.br www.quaddraconsultoria.com.br;
    
    # API Backend (Fastify) - rotas específicas
    location /api/health {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api/processes {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Frontend Next.js (inclui rotas /api do Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
    
    sudo ln -sf /etc/nginx/sites-available/quaddra /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    sudo nginx -t
    sudo systemctl restart nginx
    
    echo "✅ Nginx configurado!"
ENDSSH

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  PASSO 6: Configurar SSL (HTTPS)      ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

read -p "Configurar SSL com Certbot? (S/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[SsYy]$ ]]; then
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
        echo "🔐 Instalando Certbot..."
        sudo apt install certbot python3-certbot-nginx -y
        
        echo "🔒 Obtendo certificado SSL..."
        sudo certbot --nginx -d quaddraconsultoria.com.br -d www.quaddraconsultoria.com.br --non-interactive --agree-tos --email admin@quaddraconsultoria.com.br
        
        echo "✅ SSL configurado!"
ENDSSH
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ DEPLOY CONCLUÍDO COM SUCESSO!      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}🌐 Seu site está online em:${NC}"
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo ""
echo -e "${YELLOW}📊 Gerenciar aplicações:${NC}"
echo -e "  ${BLUE}ssh ${VPS_USER}@${VPS_IP}${NC}"
echo -e "  pm2 status"
echo -e "  pm2 logs"
echo ""

