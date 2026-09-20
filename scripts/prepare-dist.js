import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy essential web application files
const filesToCopy = [
  'game-launcher.html',
  'game-launcher.css',
  'game-launcher.js',
  'pack-games.json',
  'game-metadata.json'
];

for (const file of filesToCopy) {
  const src = path.resolve(rootDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.resolve(distDir, file));
  }
}

// Ensure index.html exists in dist (Tauri's default entry point)
const htmlSrc = path.resolve(rootDir, 'game-launcher.html');
if (fs.existsSync(htmlSrc)) {
  fs.copyFileSync(htmlSrc, path.resolve(distDir, 'index.html'));
}

// Ensure assets folder is linked or copied
const assetsDist = path.resolve(distDir, 'assets');
const assetsSrc = path.resolve(rootDir, 'assets');
if (!fs.existsSync(assetsDist) && fs.existsSync(assetsSrc)) {
  try {
    fs.symlinkSync(assetsSrc, assetsDist, 'junction');
    console.log('Linked assets directory via junction.');
  } catch {
    console.log('Junction failed, copying assets directory...');
    fs.cpSync(assetsSrc, assetsDist, { recursive: true });
  }
}

console.log('Frontend assets successfully prepared in dist/');
