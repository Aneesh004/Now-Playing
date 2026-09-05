import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const targetExe = path.resolve('release', 'win-unpacked', 'Spotify Mini Player.exe');
const workingDir = path.resolve('release', 'win-unpacked');
const rootLnk = path.resolve('Spotify Mini Player.lnk');

const psScript = `
$WshShell = New-Object -comObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut((Join-Path $desktop 'Spotify Mini Player.lnk'))
$Shortcut.TargetPath = '${targetExe.replace(/\\/g, '\\\\')}'
$Shortcut.WorkingDirectory = '${workingDir.replace(/\\/g, '\\\\')}'
$Shortcut.Description = 'Spotify Mini Player'
$Shortcut.Save()

$RootShortcut = $WshShell.CreateShortcut('${rootLnk.replace(/\\/g, '\\\\')}')
$RootShortcut.TargetPath = '${targetExe.replace(/\\/g, '\\\\')}'
$RootShortcut.WorkingDirectory = '${workingDir.replace(/\\/g, '\\\\')}'
$RootShortcut.Description = 'Spotify Mini Player'
$RootShortcut.Save()
Write-Host "Created shortcut on Desktop at: $(Join-Path $desktop 'Spotify Mini Player.lnk')"
Write-Host "Created shortcut in project folder at: ${rootLnk.replace(/\\/g, '\\\\')}"
`;

fs.writeFileSync('temp_shortcut.ps1', psScript, 'utf8');
execSync('powershell -ExecutionPolicy Bypass -File temp_shortcut.ps1', { stdio: 'inherit' });
fs.unlinkSync('temp_shortcut.ps1');

