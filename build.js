#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';

// Convert ESM URL to path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get plugin version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const PLUGIN_VERSION = packageJson.version;

// Plugin info
const PLUGIN_NAME = 'magicassistant';
const BUILD_DIR = path.join(__dirname, 'build');
const DIST_DIR = path.join(__dirname, 'dist');
const ZIP_PATH = path.join(__dirname, `${PLUGIN_NAME}-${PLUGIN_VERSION}.zip`);

// Files and directories to include in the build
const includeFiles = [
  'magicassistant.php',
  'README.md',
  'includes',
  'assets',
  'languages',
  'uninstall.php',
  'dist',
  'readme.txt',
  'LICENSE'
];

// Files and directories to exclude from the build
const excludePatterns = [
  '.DS_Store',
  'node_modules',
  '.git',
  '.github',
  '.vscode',
  '.cursor',
  'vite.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'package.json',
  'package-lock.json',
  'composer.json',
  'composer.lock',
  'build.js',
  'version-sync.js',
  'update-version.js',
  'BUILD.md',
  'test-mcp.js',
  '.gitignore',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'jsconfig.json',
  '.flowbite-react'
];

console.log(`🚀 Building MagicAssistant v${PLUGIN_VERSION}...`);

// Check if package.json version matches plugin file
console.log('🔄 Checking version consistency...');
const pluginFileContent = fs.readFileSync('./magicassistant.php', 'utf8');
const versionMatch = pluginFileContent.match(/Version:\s*(.+)/);
if (versionMatch) {
  const pluginVersion = versionMatch[1].trim();
  if (pluginVersion !== PLUGIN_VERSION) {
    console.warn(`⚠️ Warning: package.json version (${PLUGIN_VERSION}) doesn't match plugin file version (${pluginVersion})`);
    
    // Try to run version sync if the script exists
    if (fs.existsSync('./version-sync.js')) {
      console.log('🔧 Running version sync...');
      try {
        execSync('node version-sync.js', { stdio: 'inherit' });
        console.log('✅ Version sync completed');
      } catch (error) {
        console.warn('⚠️ Version sync failed, continuing with build...');
      }
    } else {
      console.warn('⚠️ Consider updating the plugin file version to match package.json');
    }
  } else {
    console.log(`✅ Version consistency check passed: ${PLUGIN_VERSION}`);
  }
} else {
  console.warn('⚠️ Could not find version in plugin file');
}

// Clean previous build
console.log('🧹 Cleaning previous build...');
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Run Vite build
console.log('🔨 Building React application...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Verify dist directory exists and has content
if (!fs.existsSync(DIST_DIR) || fs.readdirSync(DIST_DIR).length === 0) {
  console.error('❌ Build failed: dist directory is empty or missing');
  process.exit(1);
}

console.log('✅ React build completed successfully');

// Copy files to build directory
console.log('📋 Copying plugin files...');
let filesCopied = 0;
let directoriesCopied = 0;

for (const file of includeFiles) {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(BUILD_DIR, PLUGIN_NAME, file);
  
  if (fs.existsSync(srcPath)) {
    if (fs.lstatSync(srcPath).isDirectory()) {
      // Copy directory recursively
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const { files, dirs } = copyDirectoryRecursively(srcPath, destPath, file);
      filesCopied += files;
      directoriesCopied += dirs;
      console.log(`  ✓ Copied directory: ${file} (${files} files, ${dirs} subdirectories)`);
    } else {
      // Copy single file
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      filesCopied++;
      console.log(`  ✓ Copied file: ${file}`);
    }
  } else {
    console.warn(`  ⚠️ Warning: ${file} does not exist and will be skipped.`);
  }
}

console.log(`📋 Copied ${filesCopied} files and ${directoriesCopied} directories`);

// Create zip file
console.log('📦 Creating distribution zip...');
try {
  createZip(BUILD_DIR, ZIP_PATH);
  
  // Get file size for output
  const stats = fs.statSync(ZIP_PATH);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`✅ Plugin built successfully!`);
  console.log(`📦 File: ${ZIP_PATH}`);
  console.log(`📏 Size: ${fileSizeInMB} MB`);
  console.log(`🏷️ Version: ${PLUGIN_VERSION}`);
} catch (error) {
  console.error('❌ Failed to create zip file:', error.message);
  process.exit(1);
}

// Clean up build directory
console.log('🧹 Cleaning up temporary files...');
fs.rmSync(BUILD_DIR, { recursive: true, force: true });

console.log('🎉 Build process completed successfully!');

/**
 * Copy a directory recursively
 * @param {string} sourceDir 
 * @param {string} targetDir 
 * @param {string} relativePath - Path relative to project root for context-aware exclusions
 * @returns {object} Object with files and dirs count
 */
function copyDirectoryRecursively(sourceDir, targetDir, relativePath = '') {
  let filesCount = 0;
  let dirsCount = 0;
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    dirsCount++;
  }
  
  const items = fs.readdirSync(sourceDir);
  
  for (const item of items) {
    const currentRelativePath = relativePath ? path.join(relativePath, item) : item;
    
    // Only exclude top-level patterns, not patterns within subdirectories
    if (relativePath === '' && excludePatterns.includes(item)) {
      continue;
    }
    
    // Special handling for the main src directory (only exclude if at root level)
    if (item === 'src' && relativePath === '') {
      continue; // Exclude only the main React src directory
    }
    
    // Skip .DS_Store files everywhere
    if (item === '.DS_Store') {
      continue;
    }
    
    // Skip hidden files (except specific ones we might need)
    if (item.startsWith('.') && !item.match(/\.(htaccess|gitkeep)$/)) {
      continue;
    }
    
    const sourcePath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);
    
    if (fs.lstatSync(sourcePath).isDirectory()) {
      const subCounts = copyDirectoryRecursively(sourcePath, targetPath, currentRelativePath);
      filesCount += subCounts.files;
      dirsCount += subCounts.dirs;
    } else {
      // Skip certain file types
      if (item.match(/\.(log|tmp|temp|cache)$/i)) {
        continue;
      }
      
      fs.copyFileSync(sourcePath, targetPath);
      filesCount++;
    }
  }
  
  return { files: filesCount, dirs: dirsCount };
}

/**
 * Create a zip file from a directory
 * @param {string} sourceDir 
 * @param {string} outputPath 
 */
function createZip(sourceDir, outputPath) {
  const zip = new AdmZip();
  
  // Add the entire plugin directory to zip
  zip.addLocalFolder(sourceDir);
  
  // Write the zip file
  zip.writeZip(outputPath);
  
  if (!fs.existsSync(outputPath)) {
    throw new Error('Failed to create zip file');
  }
} 