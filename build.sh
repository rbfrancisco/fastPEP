#!/bin/bash

# Exit on error
set -e

# Debug: Check if password is set (don't print the actual password)
if [ -z "$STATICRYPT_PASSWORD" ]; then
  echo "Error: STATICRYPT_PASSWORD environment variable is not set"
  exit 1
else
  echo "Password is set (length: ${#STATICRYPT_PASSWORD})"
fi

# Clean and create dist directory
rm -rf dist
mkdir -p dist/admin dist/js dist/css dist/data

# Encrypt HTML files with verbose output
echo "Encrypting index.html..."
npx staticrypt index.html -p "$STATICRYPT_PASSWORD" -o dist/index.html --short 2>&1

echo "Encrypting admin/index.html..."
npx staticrypt admin/index.html -p "$STATICRYPT_PASSWORD" -o dist/admin/index.html --short 2>&1

# Verify encryption worked by checking for password prompt in output
echo "Verifying encryption..."
if grep -q "staticrypt" dist/index.html; then
  echo "✓ index.html is encrypted"
else
  echo "✗ index.html does NOT appear to be encrypted!"
  head -20 dist/index.html
fi

# Copy assets
echo "Copying assets..."
cp -r js/* dist/js/
cp -r css/* dist/css/
cp -r data/* dist/data/
cp -r admin/js dist/admin/
cp -r admin/css dist/admin/

# List output files
echo "Output files:"
ls -la dist/
ls -la dist/admin/

echo "Build complete!"
