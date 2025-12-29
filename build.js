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

function encryptFile(inputPath, outputPath) {
  console.log(`Encrypting ${inputPath} -> ${outputPath}`);
  
  // Use staticrypt with --stdout and capture the output
  const cmd = `./node_modules/.bin/staticrypt "${inputPath}" -p "${password}" --short --stdout`;
  console.log(`Running: staticrypt ${inputPath} -p [HIDDEN] --short --stdout`);
  
  try {
    const encrypted = execSync(cmd, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (!encrypted || encrypted.length === 0) {
      console.error(`ERROR: staticrypt returned empty output for ${inputPath}`);
      // Fallback: just copy the original file
      console.log('Falling back to copying original file...');
      fs.copyFileSync(inputPath, outputPath);
    } else {
      fs.writeFileSync(outputPath, encrypted);
      console.log(`✓ Created ${outputPath} (${encrypted.length} bytes)`);
    }
  } catch (err) {
    console.error(`Command failed:`, err.message);
    if (err.stdout) console.error('stdout:', err.stdout);
    if (err.stderr) console.error('stderr:', err.stderr);
    throw err;
  }
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

// Check staticrypt version
console.log('Checking staticrypt...');
try {
  const version = execSync('./node_modules/.bin/staticrypt --version', { encoding: 'utf8' });
  console.log('staticrypt version:', version.trim());
} catch (e) {
  console.log('Could not get version');
}

// Encrypt HTML files
encryptFile('index.html', 'dist/index.html');
encryptFile('admin/index.html', 'dist/admin/index.html');

// Copy assets
console.log('Copying assets...');
copyDir('js', 'dist/js');
copyDir('css', 'dist/css');
copyDir('data', 'dist/data');
copyDir('admin/js', 'dist/admin/js');
copyDir('admin/css', 'dist/admin/css');

// Verify
console.log('\nFinal dist contents:');
const listFiles = (dir, prefix = '') => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      console.log(`${prefix}${entry.name}/`);
      listFiles(fullPath, prefix + '  ');
    } else {
      const size = fs.statSync(fullPath).size;
      console.log(`${prefix}${entry.name} (${size} bytes)`);
    }
  }
};
listFiles('dist');

console.log('\nBuild complete!');
