import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Compiling PollarOfflineVault (Solidity) ===\n');

const contractPath = path.resolve(__dirname, 'PollarVault.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'PollarVault.sol': {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.methodIdentifiers']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

let hasErrors = false;
if (output.errors) {
  for (const error of output.errors) {
    if (error.severity === 'error') {
      console.error(`[ERROR] ${error.formattedMessage}`);
      hasErrors = true;
    } else {
      console.warn(`[WARNING] ${error.formattedMessage}`);
    }
  }
}

if (hasErrors) {
  console.error('\n[FAILED] Compilation failed with errors.');
  process.exit(1);
}

const contract = output.contracts['PollarVault.sol']['PollarOfflineVault'];
const bytecode = contract.evm.bytecode.object;
const deployedBytecode = contract.evm.deployedBytecode.object;
const abi = contract.abi;
const methodIdentifiers = contract.evm.methodIdentifiers;

// Save build artifacts
const buildDir = path.resolve(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const artifactPath = path.resolve(buildDir, 'PollarVault.json');
fs.writeFileSync(
  artifactPath,
  JSON.stringify(
    {
      contractName: 'PollarOfflineVault',
      abi,
      bytecode: `0x${bytecode}`,
      deployedBytecode: `0x${deployedBytecode}`,
      methodIdentifiers
    },
    null,
    2
  )
);

console.log('✓ Compilation Successful!');
console.log(`✓ Artifact saved to: ${artifactPath}`);
console.log(`✓ Bytecode Size: ${bytecode.length / 2} bytes`);
console.log('\nMethod Selectors:');
for (const [method, selector] of Object.entries(methodIdentifiers)) {
  console.log(`  - 0x${selector} : ${method}`);
}

console.log('\nContract ABI Entries:', abi.length);
