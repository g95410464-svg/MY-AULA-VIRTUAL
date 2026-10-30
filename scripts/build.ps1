$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    & npm.cmd ci --prefix frontend
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias del frontend.' }
    & npm.cmd run build --prefix frontend
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del frontend.' }
    & mvn.cmd -f backend/pom.xml -DskipTests package
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del backend. Verifica Java 21 y Maven.' }
    Write-Output 'Listo: backend/target/aula-virtual-1.0.0.jar'
} finally { Pop-Location }
