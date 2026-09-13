import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Compiling Pollar EVM Contracts (Solidity 0.8.20) ===\n');

const contracts = [
  { file: 'PollarVault.sol', contract: 'PollarOfflineVault', output: 'PollarVault.json' },
  { file: 'MockUSDC.sol', contract: 'MockUSDC', output: 'MockUSDC.json' },
  { file: 'PollarForwarder.sol', contract: 'PollarForwarder', output: 'PollarForwarder.json' }
];

const sources = {};
for (const c of contracts) {
  const filePath = path.resolve(__dirname, c.file);
  if (fs.existsSync(filePath)) {
    sources[c.file] = { content: fs.readFileSync(filePath, 'utf8') };
  }
}

const input = {
  language: 'Solidity',
  sources,
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

const buildDir = path.resolve(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

for (const c of contracts) {
  const compiled = output.contracts[c.file]?.[c.contract];
  if (!compiled) {
    console.error(`[ERROR] Contract ${c.contract} not found in ${c.file}`);
    continue;
  }

  const bytecode = compiled.evm.bytecode.object;
  const deployedBytecode = compiled.evm.deployedBytecode.object;
  const abi = compiled.abi;
  const methodIdentifiers = compiled.evm.methodIdentifiers;

  const artifactPath = path.resolve(buildDir, c.output);
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        contractName: c.contract,
        sourceFile: c.file,
        abi,
        bytecode: `0x${bytecode}`,
        deployedBytecode: `0x${deployedBytecode}`,
        methodIdentifiers
      },
      null,
      2
    )
  );

  console.log(`✓ Compiled: ${c.contract} (${c.file}) -> build/${c.output}`);
  console.log(`  Bytecode Size: ${bytecode.length / 2} bytes | Methods: ${Object.keys(methodIdentifiers).length}`);
}

console.log('\n✓ All contracts compiled successfully!');
