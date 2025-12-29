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
  
  // pagecrypt <input> <output> <password>
  const cmd = `./node_modules/.bin/pagecrypt "${inputPath}" "${outputPath}" "${password}"`;
  console.log(`Running: pagecrypt ${inputPath} ${outputPath} [HIDDEN]`);
  
  try {
    execSync(cmd, { 
      encoding: 'utf8',
      stdio: 'inherit'
    });
    
    if (fs.existsSync(outputPath)) {
      const size = fs.statSync(outputPath).size;
      console.log(`✓ Created ${outputPath} (${size} bytes)`);
    } else {
      console.error(`ERROR: ${outputPath} was not created`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Command failed:`, err.message);
    process.exit(1);
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
