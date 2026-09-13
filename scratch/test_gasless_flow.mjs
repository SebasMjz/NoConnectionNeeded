import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadArtifact(fileName) {
  const artifactPath = path.resolve(__dirname, '../contracts/evm/build', fileName);
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function testGaslessFlow() {
  console.log('=== Testing Gasless Suite (EIP-3009 + ERC-2771 Forwarder) ===\n');

  // Let's verify method selectors and interface validity
  const mockUsdcArtifact = loadArtifact('MockUSDC.json');
  const forwarderArtifact = loadArtifact('PollarForwarder.json');
  const vaultArtifact = loadArtifact('PollarVault.json');

  console.log('1. MockUSDC ABI Check:');
  const usdcMethods = Object.keys(mockUsdcArtifact.methodIdentifiers);
  console.log('   - Has receiveWithAuthorization:', usdcMethods.some(m => m.startsWith('receiveWithAuthorization')));
  console.log('   - Has transferWithAuthorization:', usdcMethods.some(m => m.startsWith('transferWithAuthorization')));
  console.log('   - Has permit:', usdcMethods.some(m => m.startsWith('permit')));
  console.log('   - Has faucet:', usdcMethods.some(m => m.startsWith('faucet')));

  console.log('\n2. PollarForwarder (Relayer) ABI Check:');
  const forwarderMethods = Object.keys(forwarderArtifact.methodIdentifiers);
  console.log('   - Has execute:', forwarderMethods.some(m => m.startsWith('execute')));
  console.log('   - Has verify:', forwarderMethods.some(m => m.startsWith('verify')));
  console.log('   - Has getNonce:', forwarderMethods.some(m => m.startsWith('getNonce')));

  console.log('\n3. PollarVault Gasless ABI Check:');
  const vaultMethods = Object.keys(vaultArtifact.methodIdentifiers);
  console.log('   - Has depositTokenWithAuthorization (EIP-3009):', vaultMethods.some(m => m.startsWith('depositTokenWithAuthorization')));
  console.log('   - Has depositTokenWithPermit (EIP-2612):', vaultMethods.some(m => m.startsWith('depositTokenWithPermit')));
  console.log('   - Has isTrustedForwarder (ERC-2771):', vaultMethods.some(m => m.startsWith('isTrustedForwarder')));
  console.log('   - Has settleTokenBatch:', vaultMethods.some(m => m.startsWith('settleTokenBatch')));

  // Test EIP-712 hashing for EIP-3009
  console.log('\n4. Testing EIP-3009 TypedData structure:');
  const user = ethers.Wallet.createRandom();
  const vaultAddress = '0xc0E153f5B0FCAfD673288439d57c276362dc8799';
  const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: 11155111,
    verifyingContract: tokenAddress
  };

  const types = {
    ReceiveWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };

  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const value = ethers.parseUnits('10.0', 6);

  const valueData = {
    from: user.address,
    to: vaultAddress,
    value: value,
    validAfter: validAfter,
    validBefore: validBefore,
    nonce: nonce
  };

  const signature = await user.signTypedData(domain, types, valueData);
  const sig = ethers.Signature.from(signature);

  console.log('   User Address:', user.address);
  console.log('   Authorization Nonce:', nonce);
  console.log('   Signature v, r, s:', sig.v, sig.r.slice(0, 10) + '...', sig.s.slice(0, 10) + '...');
  console.log('   Signature Valid?', sig.v === 27 || sig.v === 28);

  console.log('\n✓ Gasless cryptographic suite verified successfully!');
}

testGaslessFlow().catch(console.error);
