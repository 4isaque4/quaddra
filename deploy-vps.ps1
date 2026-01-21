# ============================================
# Script Automático de Deploy VPS - Quaddra
# Hostinger VPS + Domínio
# Para Windows PowerShell
# ============================================

$ErrorActionPreference = "Stop"

# Configurações
$DOMAIN = "quaddraconsultoria.com.br"
$VPS_IP = "82.29.60.183"
$VPS_USER = "root"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploy Automático VPS - Quaddra      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configurações:" -ForegroundColor Yellow
Write-Host "  Dominio: $DOMAIN" -ForegroundColor Green
Write-Host "  VPS IP: $VPS_IP" -ForegroundColor Green
Write-Host "  Usuario: $VPS_USER" -ForegroundColor Green
Write-Host ""

# Confirmar
$confirma = Read-Host "Continuar com o deploy? (S/n)"
if ($confirma -ne "S" -and $confirma -ne "s") {
    Write-Host "Deploy cancelado." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 1: Configurar servidor VPS     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Conectar ao VPS e configurar
$sshCommands1 = @"
echo '[1/4] Atualizando sistema...'
sudo apt update
sudo apt upgrade -y

echo '[2/4] Instalando Node.js...'
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

echo '[3/4] Instalando Nginx...'
sudo apt install nginx -y

echo '[4/4] Instalando PM2...'
sudo npm install -g pm2

echo 'Configuracao basica concluida!'
"@

ssh "${VPS_USER}@${VPS_IP}" $sshCommands1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 2: Preparar arquivos locais    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Criar arquivo .env se não existir
if (-not (Test-Path ".env")) {
    Write-Host "Criando arquivo .env..." -ForegroundColor Cyan
    $envContent = @"
NEXT_PUBLIC_API_URL=https://$DOMAIN
NODE_ENV=production
PORT=4000
"@
    $envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
}

# Build local
Write-Host "Instalando dependencias..." -ForegroundColor Cyan
npm install

Write-Host "Fazendo build do projeto..." -ForegroundColor Cyan
Set-Location apps/api
npm install
npm run build
Set-Location ../web
npm install
Set-Location ../..

Write-Host "Extraindo descricoes BPMN..." -ForegroundColor Cyan
npm run extract-bpmn

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 3: Enviar arquivos para VPS    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Criar estrutura no VPS
ssh "${VPS_USER}@${VPS_IP}" "mkdir -p /var/www/quaddra"

Write-Host "Enviando arquivos do projeto..." -ForegroundColor Cyan

# Usar scp se disponível, senão orientar manualmente
try {
    # Criar ZIP temporário
    $zipFile = "quaddra-temp.zip"
    Compress-Archive -Path "apps","package.json","package-lock.json","tools",".env" -DestinationPath $zipFile -Force
    
    # Enviar ZIP
    scp $zipFile "${VPS_USER}@${VPS_IP}:/root/"
    
    # Descompactar no VPS
    $sshCommands2 = @"
cd /var/www
rm -rf quaddra
mkdir -p quaddra
cd quaddra
unzip -q /root/quaddra-temp.zip
rm /root/quaddra-temp.zip
"@
    
    ssh "${VPS_USER}@${VPS_IP}" $sshCommands2
    
    # Remover ZIP local
    Remove-Item $zipFile -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "NAO foi possivel automatizar o upload. Use WinSCP ou FileZilla:" -ForegroundColor Yellow
    Write-Host "    Host: $VPS_IP" -ForegroundColor White
    Write-Host "    Pasta: /var/www/quaddra" -ForegroundColor White
    Write-Host ""
    Write-Host "Depois disso, pressione Enter para continuar..."
    Read-Host
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 4: Build e Iniciar no VPS      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Build e iniciar no VPS
$sshCommands3 = @"
cd /var/www/quaddra

echo 'Instalando dependencias no VPS...'
npm install

echo 'Fazendo build da API...'
cd apps/api
npm install
npm run build
cd ../..

echo 'Fazendo build do Frontend...'
cd apps/web
npm install
npm run build
cd ../..

echo 'Iniciando aplicacoes com PM2...'
pm2 delete quaddra-api quaddra-web 2>/dev/null || true

cd apps/api
pm2 start ecosystem.config.js

cd ../web
pm2 start npm --name quaddra-web -- start

pm2 save

echo 'Aplicacoes iniciadas!'
"@

ssh "${VPS_USER}@${VPS_IP}" $sshCommands3

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 5: Configurar Nginx            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configurar Nginx
$nginxConfig = @"
server {
    listen 80;
    server_name quaddraconsultoria.com.br www.quaddraconsultoria.com.br;
    
    # API Backend (Fastify) - rotas especificas
    location /api/health {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
    }
    
    location /api/processes {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
    }
    
    # Frontend Next.js (inclui rotas /api do Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
    }
}
"@

$nginxConfig | ssh "${VPS_USER}@${VPS_IP}" "sudo tee /etc/nginx/sites-available/quaddra > /dev/null"

$sshCommands4 = @"
sudo ln -sf /etc/nginx/sites-available/quaddra /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
echo 'Nginx configurado!'
"@

ssh "${VPS_USER}@${VPS_IP}" $sshCommands4

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 6: Configurar SSL (HTTPS)      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$sslConfirm = Read-Host "Configurar SSL com Certbot? (S/n)"
if ($sslConfirm -eq "S" -or $sslConfirm -eq "s") {
    $sshCommands5 = @"
echo 'Instalando Certbot...'
sudo apt install certbot python3-certbot-nginx -y

echo 'Obtendo certificado SSL...'
sudo certbot --nginx -d quaddraconsultoria.com.br -d www.quaddraconsultoria.com.br --non-interactive --agree-tos --email admin@quaddraconsultoria.com.br

echo 'SSL configurado!'
"@
    
    ssh "${VPS_USER}@${VPS_IP}" $sshCommands5
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY CONCLUIDO COM SUCESSO!        " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Seu site esta online em:" -ForegroundColor Yellow
Write-Host "  https://$DOMAIN" -ForegroundColor Green
Write-Host ""
Write-Host "Gerenciar aplicacoes:" -ForegroundColor Yellow
Write-Host "  ssh ${VPS_USER}@${VPS_IP}" -ForegroundColor Cyan
Write-Host "  pm2 status" -ForegroundColor Cyan
Write-Host "  pm2 logs" -ForegroundColor Cyan
Write-Host ""
