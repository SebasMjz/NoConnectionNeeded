#!/usr/bin/env node
// fix-capacitor-html.cjs - Remove crossorigin from built HTML for Capacitor Android
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'dist', 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.log('dist/index.html not found, skipping');
  process.exit(0);
}

let html = fs.readFileSync(htmlPath, 'utf8');
const original = html;

// Remove crossorigin attribute from script and link tags
html = html.replace(/\scrossorigin(?:\s*=\s*["'][^"']*["'])?/g, '');

if (html !== original) {
  fs.writeFileSync(htmlPath, html);
  console.log('[Capacitor Fix] Removed crossorigin from dist/index.html');
} else {
  console.log('[Capacitor Fix] No crossorigin found in dist/index.html');
}
