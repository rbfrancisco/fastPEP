#!/bin/bash

# Exit on error
set -e

# Debug: Check if password is set
if [ -z "$STATICRYPT_PASSWORD" ]; then
  echo "Error: STATICRYPT_PASSWORD environment variable is not set"
  exit 1
else
  echo "Password is set (length: ${#STATICRYPT_PASSWORD})"
fi

# Clean and create dist directory
rm -rf dist
mkdir -p dist/admin dist/js dist/css dist/data

# Check source files exist
echo "Checking source files..."
ls -la index.html
ls -la admin/index.html

# Install staticrypt explicitly first
echo "Installing staticrypt..."
npm install staticrypt --save-dev

# Encrypt HTML files - capture all output
echo "Encrypting index.html..."
./node_modules/.bin/staticrypt index.html -p "$STATICRYPT_PASSWORD" -o dist/index.html --short || echo "staticrypt failed with exit code $?"

echo "Contents of dist after first encryption:"
ls -la dist/

echo "Encrypting admin/index.html..."
./node_modules/.bin/staticrypt admin/index.html -p "$STATICRYPT_PASSWORD" -o dist/admin/index.html --short || echo "staticrypt failed with exit code $?"

echo "Contents of dist/admin after second encryption:"
ls -la dist/admin/

# Copy assets
echo "Copying assets..."
cp -r js/* dist/js/
cp -r css/* dist/css/
cp -r data/* dist/data/
cp -r admin/js dist/admin/
cp -r admin/css dist/admin/

echo "Final dist contents:"
ls -laR dist/

echo "Build complete!"
