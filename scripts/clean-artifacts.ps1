# Read-only cleanup inventory for this app checkout.
[CmdletBinding(SupportsShouldProcess=$true)]
param()
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
foreach($relative in @('test-results','playwright-report','release/builder-debug.yml','.release/validation/desktop-tests')){
 $target=[IO.Path]::GetFullPath((Join-Path $repoRoot $relative))
 if(-not $target.StartsWith($repoRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Inventory escaped the app checkout.'}
 if(Test-Path -LiteralPath $target){Get-Item -LiteralPath $target | Select-Object FullName,LastWriteTime}
}
