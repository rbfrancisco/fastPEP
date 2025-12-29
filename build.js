const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const password = process.env.STATICRYPT_PASSWORD;

if (!password) {
  console.error('Error: STATICRYPT_PASSWORD environment variable is not set');
  process.exit(1);
}

// Clean and create dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}

fs.mkdirSync('dist/admin/js', { recursive: true });
fs.mkdirSync('dist/admin/css', { recursive: true });
fs.mkdirSync('dist/js', { recursive: true });
fs.mkdirSync('dist/css', { recursive: true });
fs.mkdirSync('dist/data', { recursive: true });

function encryptFile(inputPath, outputPath) {
  execSync(`./node_modules/.bin/pagecrypt "${inputPath}" "${outputPath}" "${password}"`, { 
    stdio: 'inherit' 
  });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Encrypt HTML files
encryptFile('index.html', 'dist/index.html');
encryptFile('admin/index.html', 'dist/admin/index.html');

// Copy assets
copyDir('js', 'dist/js');
copyDir('css', 'dist/css');
copyDir('data', 'dist/data');
copyDir('admin/js', 'dist/admin/js');
copyDir('admin/css', 'dist/admin/css');

console.log('Build complete!');
