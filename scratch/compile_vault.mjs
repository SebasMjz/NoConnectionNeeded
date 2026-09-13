import fs from 'fs';
import solc from 'solc';

const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal ERC-20 interface for USDT / USDC transfers
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PollarOfflineVault
 * @notice EVM Escrow Vault for the Pollar Offline P2P Payment Protocol.
 * Supports Native Currency (Sepolia ETH) and ERC-20 Tokens (USDC / USDT).
 */
contract PollarOfflineVault {
    struct VaultState {
        address payer;
        uint256 lockedAmount;
        uint256 totalSettled;
        bytes32 lastMerkleRoot;
        uint64 nonce;
    }

    // Native ETH vaults: payer => VaultState
    mapping(address => VaultState) public vaults;

    // ERC-20 Token vaults: payer => token => VaultState
    mapping(address => mapping(address => VaultState)) public tokenVaults;

    // Events
    event VaultFunded(address indexed payer, uint256 amount, uint256 totalLocked);
    event TokenVaultFunded(address indexed payer, address indexed token, uint256 amount, uint256 totalLocked);
    event VaultWithdrawn(address indexed payer, uint256 amount, uint256 remainingLocked);
    event TokenVaultWithdrawn(address indexed payer, address indexed token, uint256 amount, uint256 remainingLocked);
    event BatchSettled(
        address indexed payer,
        address indexed payee,
        uint256 amount,
        bytes32 merkleRoot,
        uint64 batchNonce
    );
    event TokenBatchSettled(
        address indexed payer,
        address indexed payee,
        address indexed token,
        uint256 amount,
        bytes32 merkleRoot,
        uint64 batchNonce
    );

    // Reentrancy guard
    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "PollarVault: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    // 1. Native ETH Deposit & Withdraw
    function depositVault() public payable {
        require(msg.value > 0, "PollarVault: amount must be > 0");
        VaultState storage v = vaults[msg.sender];
        v.payer = msg.sender;
        v.lockedAmount += msg.value;
        emit VaultFunded(msg.sender, msg.value, v.lockedAmount);
    }

    function withdrawVault(uint256 amount) external nonReentrant {
        VaultState storage v = vaults[msg.sender];
        require(v.lockedAmount >= v.totalSettled + amount, "PollarVault: insufficient unlocked balance");
        v.lockedAmount -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "PollarVault: transfer failed");
        emit VaultWithdrawn(msg.sender, amount, v.lockedAmount - v.totalSettled);
    }

    // 2. ERC-20 Token Deposit & Withdraw (USDC, USDT)
    function depositTokenVault(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "PollarVault: invalid token address");
        require(amount > 0, "PollarVault: amount must be > 0");

        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(success, "PollarVault: ERC-20 transferFrom failed");

        VaultState storage v = tokenVaults[msg.sender][token];
        v.payer = msg.sender;
        v.lockedAmount += amount;
        emit TokenVaultFunded(msg.sender, token, amount, v.lockedAmount);
    }

    function withdrawTokenVault(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "PollarVault: invalid token address");
        VaultState storage v = tokenVaults[msg.sender][token];
        require(v.lockedAmount >= v.totalSettled + amount, "PollarVault: insufficient unlocked token balance");
        v.lockedAmount -= amount;
        bool success = IERC20(token).transfer(msg.sender, amount);
        require(success, "PollarVault: ERC-20 transfer failed");
        emit TokenVaultWithdrawn(msg.sender, token, amount, v.lockedAmount - v.totalSettled);
    }

    // 3. Native ETH Batch Settlement (Original function signature)
    function settleBatch(
        address payer,
        address payable payee,
        uint256 settleAmount,
        bytes32 merkleRoot,
        uint64 batchNonce
    ) external nonReentrant {
        require(payer != address(0), "PollarVault: invalid payer");
        require(payee != address(0), "PollarVault: invalid payee");
        require(settleAmount > 0, "PollarVault: amount must be > 0");

        VaultState storage v = vaults[payer];
        require(v.payer == payer, "PollarVault: vault not initialized");
        require(v.totalSettled + settleAmount <= v.lockedAmount, "PollarVault: exceeds locked vault limit");
        require(batchNonce > v.nonce, "PollarVault: batch nonce must be strictly increasing");

        v.totalSettled += settleAmount;
        v.lastMerkleRoot = merkleRoot;
        v.nonce = batchNonce;

        (bool success, ) = payee.call{value: settleAmount}("");
        require(success, "PollarVault: payment to payee failed");

        emit BatchSettled(payer, payee, settleAmount, merkleRoot, batchNonce);
    }

    // 4. ERC-20 (USDC / USDT) Batch Settlement
    function settleTokenBatch(
        address payer,
        address payee,
        address token,
        uint256 settleAmount,
        bytes32 merkleRoot,
        uint64 batchNonce
    ) external nonReentrant {
        require(payer != address(0), "PollarVault: invalid payer");
        require(payee != address(0), "PollarVault: invalid payee");
        require(token != address(0), "PollarVault: invalid token address");
        require(settleAmount > 0, "PollarVault: amount must be > 0");

        VaultState storage v = tokenVaults[payer][token];
        require(v.payer == payer, "PollarVault: token vault not initialized");
        require(v.totalSettled + settleAmount <= v.lockedAmount, "PollarVault: exceeds locked token limit");
        require(batchNonce > v.nonce, "PollarVault: batch nonce must be strictly increasing");

        v.totalSettled += settleAmount;
        v.lastMerkleRoot = merkleRoot;
        v.nonce = batchNonce;

        bool success = IERC20(token).transfer(payee, settleAmount);
        require(success, "PollarVault: ERC-20 payment to payee failed");

        emit TokenBatchSettled(payer, payee, token, settleAmount, merkleRoot, batchNonce);
    }

    // View functions
    function getVault(address payer) external view returns (
        address payerAddress,
        uint256 lockedAmount,
        uint256 totalSettled,
        uint256 availableToSpend,
        bytes32 lastMerkleRoot,
        uint64 nonce
    ) {
        VaultState memory v = vaults[payer];
        uint256 avail = v.lockedAmount > v.totalSettled ? (v.lockedAmount - v.totalSettled) : 0;
        return (v.payer, v.lockedAmount, v.totalSettled, avail, v.lastMerkleRoot, v.nonce);
    }

    function getTokenVault(address payer, address token) external view returns (
        address payerAddress,
        uint256 lockedAmount,
        uint256 totalSettled,
        uint256 availableToSpend,
        bytes32 lastMerkleRoot,
        uint64 nonce
    ) {
        VaultState memory v = tokenVaults[payer][token];
        uint256 avail = v.lockedAmount > v.totalSettled ? (v.lockedAmount - v.totalSettled) : 0;
        return (v.payer, v.lockedAmount, v.totalSettled, avail, v.lastMerkleRoot, v.nonce);
    }

    receive() external payable {
        depositVault();
    }
}
`;

const input = {
  language: 'Solidity',
  sources: { 'PollarVault.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  const errs = output.errors.filter(e => e.severity === 'error');
  if (errs.length > 0) {
    console.error('Compilation errors:', errs);
    process.exit(1);
  }
}

const contract = output.contracts['PollarVault.sol']['PollarOfflineVault'];
console.log('Solidity compilation SUCCESSFUL!');
console.log('Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');
console.log('ABI functions:', contract.abi.filter(a => a.type === 'function').map(f => f.name));
