# Estrutura de pastas para processos (BPM/BPMN)

Conforme as pastas amostra e os arquivos enviados, a estrutura deve seguir a hierarquia: **pasta raiz → pasta nível 2 (quando houver) → processo**.

---

## 1. Estrutura desejada (como deve ficar)

Os 7 processos dos arquivos que você enviou se organizam em **duas pastas raiz**:

```
storage/bpmn/
│
├── Fluxo Operação Cartão/                    ← PASTA RAIZ 1
│   ├── Faturamento Cliente 1/                ← Pasta nível 2
│   │   ├── Fluxo_OperaçãoCartão_Faturamento_Cliente_1_Geral.bpmn
│   │   ├── Fluxo_OperaçãoCartão_Faturamento_Cliente_1-1_Acumulativo.bpmn
│   │   └── Fluxo_OperaçãoCartão_Faturamento_Cliente_1-2_Renovável.bpmn
│   │
│   └── Repasse Credenciada/                  ← Pasta nível 2 (ou arquivo direto na raiz)
│       └── Fluxo_OperaçãoCartão_Repasse_Credenciada.bpmn
│
└── Fluxo Contratos/                          ← PASTA RAIZ 2
    ├── FluxoContratos_ClientePrivado.bpmn   (pode ficar na raiz ou em subpasta "Cliente Privado")
    ├── FluxoContratos_ClientePúblico.bpmn   (idem: raiz ou subpasta "Cliente Público")
    └── Credenciada/                         ← Pasta nível 2 (já existe hoje)
        └── Fluxo de Contratos - Credenciada.bpmn  (ou FluxoContratos_Credenciada.bpmn)
```

**Resumo da lógica:**
- **Operação Cartão:** uma pasta raiz com duas “subpastas”: Faturamento Cliente 1 (3 processos) e Repasse Credenciada (1 processo).
- **Contratos:** uma pasta raiz com 3 processos; o da Credenciada pode ficar numa subpasta `Credenciada/` (como hoje).

---

## 2. O que existe hoje no projeto

| Onde está hoje | Equivalente na estrutura desejada |
|----------------|-----------------------------------|
| `Fluxo de Contratos - Credenciada/Fluxo de Contratos - Credenciada.bpmn` | Fluxo Contratos → Credenciada |
| `Contratos - Clientes Setor Público.bpmn` (na raiz de bpmn) | Fluxo Contratos → ClientePúblico |

Ou seja: **só 2 dos 7 processos** aparecem no repositório atual (Contratos Cliente Público e Contratos Credenciada). O restante (Operação Cartão e Contratos Cliente Privado) **não está** em `apps/api/storage/bpmn`.

---

## 3. Processos por pasta e o que falta

### Fluxo Operação Cartão (todos faltando no repo)

| Processo | Arquivo sugerido | Onde criar |
|----------|------------------|------------|
| Geral | `Fluxo_OperaçãoCartão_Faturamento_Cliente_1_Geral.bpmn` | `Fluxo Operação Cartão/Faturamento Cliente 1/` |
| Acumulativo | `Fluxo_OperaçãoCartão_Faturamento_Cliente_1-1_Acumulativo.bpmn` | `Fluxo Operação Cartão/Faturamento Cliente 1/` |
| Renovável | `Fluxo_OperaçãoCartão_Faturamento_Cliente_1-2_Renovável.bpmn` | `Fluxo Operação Cartão/Faturamento Cliente 1/` |
| Repasse Credenciada | `Fluxo_OperaçãoCartão_Repasse_Credenciada.bpmn` | `Fluxo Operação Cartão/Repasse Credenciada/` |

### Fluxo Contratos

| Processo | Situação no repo | Onde deve ficar na estrutura |
|----------|-------------------|-----------------------------|
| Cliente Privado | Não existe | `Fluxo Contratos/FluxoContratos_ClientePrivado.bpmn` (ou em subpasta `Cliente Privado/`) |
| Cliente Público | Existe como `Contratos - Clientes Setor Público.bpmn` na raiz | Mover para `Fluxo Contratos/` (ex.: `Fluxo Contratos/FluxoContratos_ClientePúblico.bpmn` ou `Fluxo Contratos/Cliente Público/Contratos - Clientes Setor Público.bpmn`) |
| Credenciada | Existe em `Fluxo de Contratos - Credenciada/` | Manter como `Fluxo Contratos/Credenciada/Fluxo de Contratos - Credenciada.bpmn` (ou renomear pasta/arquivo para alinhar ao nome FluxoContratos_Credenciada) |

---

## 4. Como fazer na prática

### Passo 1 – Criar a árvore de pastas

**Para colar na tela "Criação rápida de estrutura" (Inserir Processos):** use o conteúdo do arquivo **`docs/estrutura-pastas-para-colar.txt`** — copie tudo e cole no campo; em seguida clique em **"Criar árvore de pastas"**.

Ou crie manualmente dentro de `apps/api/storage/bpmn/`:

```
Fluxo Operação Cartão
Fluxo Operação Cartão/Faturamento Cliente 1
Fluxo Operação Cartão/Repasse Credenciada
Fluxo Contratos
Fluxo Contratos/Credenciada   (opcional se quiser manter a subpasta só para Credenciada)
```

(Se preferir “Cliente Privado” e “Cliente Público” como subpastas, crie também `Fluxo Contratos/Cliente Privado` e `Fluxo Contratos/Cliente Público`.)

### Passo 2 – Colocar os arquivos

- **Operação Cartão:** copiar/exportar do Bizagi os 4 arquivos `.bpm` (ou `.bpmn`) para os caminhos da tabela acima.
- **Contratos – Cliente Público:** mover (ou copiar) `Contratos - Clientes Setor Público.bpmn` para dentro de `Fluxo Contratos/` (ou em `Fluxo Contratos/Cliente Público/`).
- **Contratos – Credenciada:** deixar como está em `Fluxo de Contratos - Credenciada/` ou mover para `Fluxo Contratos/Credenciada/` e ajustar nome do arquivo se quiser padronizar.
- **Contratos – Cliente Privado:** quando tiver o arquivo, colocar em `Fluxo Contratos/` (ou em `Fluxo Contratos/Cliente Privado/`).

### Passo 3 – Conferir na aplicação

O `listLocalBpmnFiles()` percorre todas as subpastas de `storage/bpmn` e considera qualquer `.bpmn`. Depois de organizar, os processos devem aparecer na listagem da aplicação; o **slug** é gerado a partir do caminho relativo (ex.: `fluxo-operacao-cartao/faturamento-cliente-1/fluxo-operacaocartao-faturamento-cliente-1-geral`).

---

## 5. Resumo visual (espelhando o desenho do Fernando)

```
<NOME DA PASTA RAIZ> = "Processos" ou usar direto "Fluxo Operação Cartão" e "Fluxo Contratos"

Fluxo Operação Cartão
    └── <NIVEL 2> Faturamento Cliente 1
            └── PROCESSO: Geral, Acumulativo, Renovável
    └── <NIVEL 2> Repasse Credenciada
            └── PROCESSO: Repasse Credenciada

Fluxo Contratos
    └── PROCESSO: Cliente Privado
    └── PROCESSO: Cliente Público
    └── <NIVEL 2> Credenciada
            └── PROCESSO: Credenciada
```

Assim a estrutura fica alinhada às pastas amostra e aos 7 processos que você enviou; processos diferentes (que não estavam no repo) foram incluídos na organização acima.

---

## 6. Comportamento do upload (regras)

Ao usar **Inserir Novo Processo** e enviar arquivos para o repositório GitHub (ex.: Vale Shop), valem as seguintes regras:

| Regra | Descrição |
|-------|-----------|
| **Commit só quando houver mudança** | Se todos os arquivos enviados (caminho + conteúdo) já forem iguais ao que está no repositório, **nenhum commit** é feito. A tela informa: *"Arquivos e pastas já estão iguais ao repositório. Nenhum commit necessário."* |
| **Upload em lotes** | Os arquivos são enviados em lotes (por pasta). Se um lote for "igual" ao repo, o próximo lote ainda é enviado. Assim, pastas novas ou alteradas são commitadas mesmo quando outras pastas já estão iguais. |
| **Conflito de histórico (fast-forward)** | Se a branch `main` no GitHub for atualizada durante o upload, a API tenta de novo (até 3 vezes) usando a ponta mais recente da branch, para evitar erro *"Update is not a fast forward"*. |
| **Repositório ou branch inexistente** | Se o repositório ou a branch (ex.: `main`) não existir no GitHub, a API retorna erro claro pedindo para criar o repositório e a branch primeiro. |
| **Apenas arquivos .bpmn** | Apenas arquivos com extensão `.bpmn` são enviados; os demais são ignorados. |
| **Sanitização de nomes** | Caracteres inválidos em nomes de pasta/arquivo (ex.: `<>:"|?*`) são substituídos por `-`; barras invertidas e espaços múltiplos são normalizados. |

**Resumo:** Pode fazer reupload à vontade: o que já está igual não gera commit; só o que for novo ou alterado é enviado.
