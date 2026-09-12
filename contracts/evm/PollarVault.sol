// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PollarOfflineVault
 * @notice EVM Escrow Vault for the Pollar Offline P2P Payment Protocol.
 * Supports Ethereum Sepolia, Base Sepolia, HashKey Chain HSK, and any EVM network.
 * 
 * Flow:
 * 1. Payer calls depositVault() while online to lock funds in escrow.
 * 2. Payer and Payee transact peer-to-peer completely offline using dual-signed EIP-712 vouchers.
 * 3. When either party reconnects online, settleBatch() is submitted with the aggregated
 *    Merkle Root to release escrowed funds directly to the Payee.
 */
contract PollarOfflineVault {
    struct VaultState {
        address payer;
        uint256 lockedAmount;
        uint256 totalSettled;
        bytes32 lastMerkleRoot;
        uint64 nonce;
    }

    // Mapping from Payer address to their offline vault state
    mapping(address => VaultState) public vaults;

    // Events
    event VaultFunded(address indexed payer, uint256 amount, uint256 totalLocked);
    event VaultWithdrawn(address indexed payer, uint256 amount, uint256 remainingLocked);
    event BatchSettled(
        address indexed payer,
        address indexed payee,
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

    /**
     * @notice Deposit native currency (e.g. Sepolia ETH, HSK, MATIC) to fund the offline vault
     */
    function depositVault() external payable {
        require(msg.value > 0, "PollarVault: amount must be > 0");
        VaultState storage v = vaults[msg.sender];
        v.payer = msg.sender;
        v.lockedAmount += msg.value;

        emit VaultFunded(msg.sender, msg.value, v.lockedAmount);
    }

    /**
     * @notice Withdraw unspent funds back to the Payer's wallet
     */
    function withdrawVault(uint256 amount) external nonReentrant {
        VaultState storage v = vaults[msg.sender];
        require(v.lockedAmount >= v.totalSettled + amount, "PollarVault: insufficient unlocked balance");

        v.lockedAmount -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "PollarVault: transfer failed");

        emit VaultWithdrawn(msg.sender, amount, v.lockedAmount - v.totalSettled);
    }

    /**
     * @notice Settle an aggregated batch of offline transactions on-chain
     * @param payer The payer whose offline vault is being debited
     * @param payee The recipient merchant receiving the settlement
     * @param settleAmount The total sum of payments in this offline batch
     * @param merkleRoot The 32-byte Merkle root representing all dual-signed vouchers
     * @param batchNonce The incremental batch sequence nonce
     */
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

        // Update state
        v.totalSettled += settleAmount;
        v.lastMerkleRoot = merkleRoot;
        v.nonce = batchNonce;

        // Transfer settled funds to the Payee/Merchant
        (bool success, ) = payee.call{value: settleAmount}("");
        require(success, "PollarVault: payment to payee failed");

        emit BatchSettled(payer, payee, settleAmount, merkleRoot, batchNonce);
    }

    /**
     * @notice Query the vault state for any payer
     */
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
        return (
            v.payer,
            v.lockedAmount,
            v.totalSettled,
            avail,
            v.lastMerkleRoot,
            v.nonce
        );
    }

    receive() external payable {
        depositVault();
    }
}
