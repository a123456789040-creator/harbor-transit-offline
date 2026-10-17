param([string]$NodeDirectory)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskRelease=Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'release.json') | ConvertFrom-Json
$taskName='HarborTransit-'+$taskRelease.version+'-win-x64'
$taskOutput=Join-Path $taskRoot ('releases\'+$taskName)
if(Test-Path -LiteralPath $taskOutput){throw 'Output exists. Keep it for verification or choose a new release version.'}
if(-not $NodeDirectory){
    $taskCache=Join-Path $taskRoot '.runtime-cache'
    New-Item -ItemType Directory -Force -Path $taskCache | Out-Null
    $taskZip=Join-Path $taskCache 'node-v24.22.0-win-x64.zip'
    $taskSums=Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/v24.22.0/SHASUMS256.txt'
    $taskHash=[regex]::Match($taskSums.Content,'(?m)^([a-f0-9]{64})\s+node-v24\.22\.0-win-x64\.zip\s*$').Groups[1].Value
    if(-not $taskHash){throw 'Official Node checksum missing'}
    if(-not (Test-Path -LiteralPath $taskZip)){Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/v24.22.0/node-v24.22.0-win-x64.zip' -OutFile $taskZip}
    if((Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLower() -ne $taskHash){throw 'Node checksum mismatch'}
    $NodeDirectory=Join-Path $taskCache 'node-v24.22.0-win-x64'
    if(-not (Test-Path -LiteralPath $NodeDirectory)){Expand-Archive -LiteralPath $taskZip -DestinationPath $taskCache}
}
foreach($taskFile in @('node.exe','LICENSE')){if(-not (Test-Path -LiteralPath (Join-Path $NodeDirectory $taskFile))){throw ('Missing runtime '+$taskFile)}}
$taskCompiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not (Test-Path -LiteralPath $taskCompiler)){throw 'Windows .NET Framework compiler missing'}
New-Item -ItemType Directory -Force -Path (Join-Path $taskOutput 'runtime') | Out-Null
foreach($taskFile in @('dist','server.mjs','release.json','README.md','LICENSE','THIRD_PARTY_NOTICES.md')){Copy-Item -LiteralPath (Join-Path $taskRoot $taskFile) -Destination $taskOutput -Recurse}
Copy-Item -LiteralPath (Join-Path $NodeDirectory 'node.exe') -Destination (Join-Path $taskOutput 'runtime\node.exe')
Copy-Item -LiteralPath (Join-Path $NodeDirectory 'LICENSE') -Destination (Join-Path $taskOutput 'runtime\LICENSE.txt')
& $taskCompiler /nologo /target:winexe /platform:x64 /codepage:65001 /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll ('/out:'+(Join-Path $taskOutput 'HarborTransit.exe')) (Join-Path $taskRoot 'scripts\Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Launcher compile failed'}
$taskArchive=$taskOutput+'.zip'
Compress-Archive -LiteralPath $taskOutput -DestinationPath $taskArchive -CompressionLevel Optimal
$taskDigest=(Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText($taskArchive+'.sha256',$taskDigest+'  '+[IO.Path]::GetFileName($taskArchive)+[Environment]::NewLine)
Write-Output $taskArchive
Write-Output ('SHA256 '+$taskDigest)
