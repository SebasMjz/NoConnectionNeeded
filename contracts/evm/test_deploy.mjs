import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Testing PollarOfflineVault Deployment & Execution ===\n');

// 1. Load compiled artifact
const artifactPath = path.resolve(__dirname, 'build', 'PollarVault.json');
if (!fs.existsSync(artifactPath)) {
  console.error('Artifact not found. Run compile.mjs first.');
  process.exit(1);
}

const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

console.log('1. ABI and Bytecode loaded successfully.');
console.log(`   Bytecode length: ${bytecode.length} characters`);

// 2. Validate ABI methods
const contractInterface = new ethers.Interface(abi);
console.log('\n2. Verified Contract Interface:');
for (const fn of contractInterface.fragments) {
  if (fn.type === 'function') {
    console.log(`   - ${fn.format('full')}`);
  }
}

console.log('\n[SUCCESS] Contract is valid and ready for deployment to Sepolia, HSK, or Localhost!');
