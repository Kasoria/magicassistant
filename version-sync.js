#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const PLUGIN_FILE = './magicassistant.php';
const PACKAGE_FILE = './package.json';

console.log('🔄 Syncing versions...');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
const packageVersion = packageJson.version;

// Read plugin file
const pluginContent = fs.readFileSync(PLUGIN_FILE, 'utf8');

// Update plugin file version
const updatedPluginContent = pluginContent.replace(
  /Version:\s*(.+)/,
  `Version:           ${packageVersion}`
);

// Update plugin constant
const updatedPluginConstant = updatedPluginContent.replace(
  /define\('MAGIC_ASSISTANT_VERSION',\s*'(.+?)'\)/,
  `define('MAGIC_ASSISTANT_VERSION', '${packageVersion}')`
);

// Write updated plugin file
fs.writeFileSync(PLUGIN_FILE, updatedPluginConstant);

console.log(`✅ Synced version to ${packageVersion}`);
console.log('  - Updated plugin header');
console.log('  - Updated MAGIC_ASSISTANT_VERSION constant'); 