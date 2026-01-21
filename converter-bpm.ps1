# Script para converter arquivos .bpm do Bizagi para .bpmn
# IMPORTANTE: Requer Bizagi Process Modeler instalado

$processosDir = "Processos"
$bpmnDir = "apps\api\storage\bpmn"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Conversor de Arquivos .bpm para .bpmn" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se a pasta Processos existe
if (-not (Test-Path $processosDir)) {
    Write-Host "ERRO: Pasta '$processosDir' não encontrada!" -ForegroundColor Red
    exit 1
}

# Criar pasta BPMN se não existir
if (-not (Test-Path $bpmnDir)) {
    New-Item -ItemType Directory -Path $bpmnDir -Force | Out-Null
    Write-Host "Pasta BPMN criada: $bpmnDir" -ForegroundColor Green
}

# Listar arquivos .bpm
$bpmFiles = Get-ChildItem -Path $processosDir -Filter "*.bpm"

if ($bpmFiles.Count -eq 0) {
    Write-Host "Nenhum arquivo .bpm encontrado na pasta Processos/" -ForegroundColor Yellow
    exit 0
}

Write-Host "Encontrados $($bpmFiles.Count) arquivos .bpm:" -ForegroundColor Yellow
$bpmFiles | ForEach-Object { Write-Host "  - $($_.Name)" }

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "ATENÇÃO: Conversão Manual Necessária" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "Arquivos .bpm do Bizagi são binários proprietários e NÃO podem" -ForegroundColor Yellow
Write-Host "ser convertidos automaticamente sem o Bizagi Process Modeler." -ForegroundColor Yellow
Write-Host ""
Write-Host "Para converter os arquivos:" -ForegroundColor Cyan
Write-Host "  1. Abra cada arquivo .bpm no Bizagi Process Modeler" -ForegroundColor White
Write-Host "  2. Vá em File > Export > BPMN 2.0" -ForegroundColor White
Write-Host "  3. Salve o arquivo .bpmn na pasta: $bpmnDir" -ForegroundColor White
Write-Host "  4. Execute: npm run extract-bpmn" -ForegroundColor White
Write-Host ""
Write-Host "Arquivos que precisam ser convertidos:" -ForegroundColor Cyan
$counter = 1
$bpmFiles | ForEach-Object {
    $bpmnName = $_.BaseName + ".bpmn"
    $bpmnPath = Join-Path $bpmnDir $bpmnName
    if (Test-Path $bpmnPath) {
        $status = "JA CONVERTIDO"
        $statusColor = "Green"
    } else {
        $status = "PENDENTE"
        $statusColor = "Red"
    }
    Write-Host "  $counter. $($_.Name) -> $bpmnName" -ForegroundColor White
    Write-Host "     Status: $status" -ForegroundColor $statusColor
    $counter++
}

Write-Host ""
Write-Host "Após converter todos os arquivos, execute:" -ForegroundColor Cyan
Write-Host "  npm run extract-bpmn" -ForegroundColor Yellow
Write-Host ""

