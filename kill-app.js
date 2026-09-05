import { execSync } from 'child_process';

try {
  execSync('taskkill /F /FI "IMAGENAME eq Spotify Mini Player.exe"', { stdio: 'ignore' });
} catch {}
try {
  execSync('taskkill /F /FI "IMAGENAME eq electron.exe"', { stdio: 'ignore' });
} catch {}
console.log('Processes cleaned');
