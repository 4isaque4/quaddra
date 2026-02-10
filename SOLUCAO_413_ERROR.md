# Solução para Erro 413 Request Entity Too Large

## Problema
O erro "413 Request Entity Too Large" ocorre quando o tamanho do payload da requisição HTTP excede os limites configurados no servidor.

## Causas Possíveis

1. **Limite padrão do Next.js App Router**: ~1MB para API Routes
2. **Proxy reverso (nginx/Apache)**: Limite de `client_max_body_size` ou `LimitRequestBody`
3. **Servidor web**: Limites de configuração do servidor

## Soluções Aplicadas

### 1. Configuração no `next.config.mjs`
- Adicionado `experimental.serverActions.bodySizeLimit: '50mb'` (funciona para Server Actions)
- Adicionado `experimental.proxyClientMaxBodySize: '50mb'` (para proxy reverso)

### 2. Middleware (`apps/web/middleware.ts`)
- Criado middleware para adicionar headers que podem ajudar com limites de tamanho

### 3. Configuração Apache (`.htaccess`)
- Adicionado `php_value upload_max_filesize 50M`
- Adicionado `php_value post_max_size 50M`

## Soluções Adicionais Necessárias

### Se estiver usando Nginx

Adicione no arquivo de configuração do nginx (geralmente em `/etc/nginx/nginx.conf` ou no site específico):

```nginx
http {
    # ...
    client_max_body_size 50M;
    
    # Ou para um servidor específico:
    server {
        # ...
        client_max_body_size 50M;
    }
}
```

Depois, reinicie o nginx:
```bash
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx  # Recarregar nginx
```

### Se estiver usando Apache

Além do `.htaccess`, você pode precisar configurar no arquivo principal do Apache (`httpd.conf` ou `apache2.conf`):

```apache
LimitRequestBody 52428800  # 50MB em bytes
```

### Se estiver usando PM2/Node.js diretamente

O limite pode estar vindo do próprio Node.js ou do servidor web na frente. Verifique:
- Variáveis de ambiente do servidor
- Configurações do PM2
- Configurações do servidor web (se houver)

## Verificação

1. Reinicie a aplicação Next.js após as mudanças:
   ```bash
   pm2 restart quaddra-web
   ```

2. Se estiver usando nginx/apache, reinicie também:
   ```bash
   # Nginx
   sudo systemctl reload nginx
   
   # Apache
   sudo systemctl reload apache2
   ```

## Limitação do Next.js App Router

**IMPORTANTE**: No Next.js 13+ App Router, não há uma forma direta de aumentar o limite de body size para API Routes como havia no Pages Router. As soluções acima podem ajudar, mas se o erro persistir, pode ser necessário:

1. Usar upload em chunks (dividir arquivos grandes)
2. Usar Server Actions em vez de API Routes
3. Configurar adequadamente o proxy reverso/servidor web na frente

## Teste

Após aplicar as configurações, teste fazendo upload de um arquivo grande (até 50MB) para verificar se o erro foi resolvido.
