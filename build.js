const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const password = process.env.STATICRYPT_PASSWORD;

if (!password) {
  console.error('Error: STATICRYPT_PASSWORD environment variable is not set');
  process.exit(1);
}

console.log(`Password is set (length: ${password.length})`);

// Clean and create dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}

fs.mkdirSync('dist/admin/js', { recursive: true });
fs.mkdirSync('dist/admin/css', { recursive: true });
fs.mkdirSync('dist/js', { recursive: true });
fs.mkdirSync('dist/css', { recursive: true });
fs.mkdirSync('dist/data', { recursive: true });

// Function to run command and show output
function run(cmd) {
  console.log(`Running: ${cmd}`);
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    if (output) console.log(output);
  } catch (err) {
    console.error(`Command failed with exit code ${err.status}`);
    console.error('stdout:', err.stdout);
    console.error('stderr:', err.stderr);
    throw err;
  }
}

// Encrypt HTML files
console.log('Encrypting index.html...');
run(`npx staticrypt index.html -p "${password}" -o dist/index.html --short`);

console.log('Checking if file was created...');
if (fs.existsSync('dist/index.html')) {
  console.log('✓ dist/index.html created, size:', fs.statSync('dist/index.html').size);
} else {
  console.log('✗ dist/index.html NOT created');
  // Try alternative syntax
  console.log('Trying alternative syntax...');
  run(`npx staticrypt index.html -p "${password}" --output dist/index.html --short`);
}

console.log('Encrypting admin/index.html...');
run(`npx staticrypt admin/index.html -p "${password}" -o dist/admin/index.html --short`);

if (fs.existsSync('dist/admin/index.html')) {
  console.log('✓ dist/admin/index.html created');
} else {
  console.log('✗ dist/admin/index.html NOT created');
  run(`npx staticrypt admin/index.html -p "${password}" --output dist/admin/index.html --short`);
}

// Copy assets
console.log('Copying assets...');

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

copyDir('js', 'dist/js');
copyDir('css', 'dist/css');
copyDir('data', 'dist/data');
copyDir('admin/js', 'dist/admin/js');
copyDir('admin/css', 'dist/admin/css');

console.log('Final dist contents:');
run('ls -laR dist');

console.log('Build complete!');
