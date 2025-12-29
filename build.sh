#!/bin/bash

# Exit on error
set -e

# Check for password
if [ -z "$STATICRYPT_PASSWORD" ]; then
  echo "Error: STATICRYPT_PASSWORD environment variable is not set"
  exit 1
fi

# Clean and create dist directory
rm -rf dist
mkdir -p dist/admin dist/js dist/css dist/data

# Encrypt HTML files
echo "Encrypting HTML files..."
npx staticrypt index.html -p "$STATICRYPT_PASSWORD" -o dist/index.html --short
npx staticrypt admin/index.html -p "$STATICRYPT_PASSWORD" -o dist/admin/index.html --short

# Copy assets
echo "Copying assets..."
cp -r js/* dist/js/
cp -r css/* dist/css/
cp -r data/* dist/data/
cp -r admin/js dist/admin/
cp -r admin/css dist/admin/

echo "Build complete!"
