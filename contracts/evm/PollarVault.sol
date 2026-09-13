// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal ERC-20 interface for USDT / USDC token support
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @dev Minimal EIP-2612 Permit interface for gasless approvals
 */
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @dev Minimal EIP-3009 interface for gasless direct authorization transfers (Circle USDC native)
 */
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title PollarOfflineVault
 * @notice Dual-Asset EVM Escrow Vault for the Pollar Offline P2P Payment Protocol.
 * Supports:
 * 1. Native Currency (Sepolia ETH) and ERC-20 Tokens (USDC / USDT).
 * 2. Gasless Onboarding via EIP-3009 (receiveWithAuthorization) and EIP-2612 (permit).
 * 3. ERC-2771 Meta-Transactions via Trusted Forwarder.
 * 4. Relayer-sponsored on-chain batch settlements.
 */
contract PollarOfflineVault {
    struct VaultState {
        address payer;
        uint256 lockedAmount;
        uint256 totalSettled;
        bytes32 lastMerkleRoot;
        uint64 nonce;
    }

    address public owner;
    address public trustedForwarder;

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
    event TrustedForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);

    // Reentrancy guard
    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "PollarVault: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyOwner() {
        require(_msgSender() == owner, "PollarVault: caller is not owner");
        _;
    }

    constructor(address _trustedForwarder) {
        owner = msg.sender;
        trustedForwarder = _trustedForwarder;
    }

    // ==========================================
    // ERC-2771 Context Implementation
    // ==========================================

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder != address(0) && forwarder == trustedForwarder;
    }

    function setTrustedForwarder(address _trustedForwarder) external onlyOwner {
        emit TrustedForwarderUpdated(trustedForwarder, _trustedForwarder);
        trustedForwarder = _trustedForwarder;
    }

    function _msgSender() internal view returns (address sender) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    // ==========================================
    // 1. Native ETH Deposit & Withdraw
    // ==========================================

    /**
     * @notice Deposit native currency (Sepolia ETH, HSK, AVAX) to fund the offline vault
     */
    function depositVault() public payable {
        require(msg.value > 0, "PollarVault: amount must be > 0");
        address sender = _msgSender();
        VaultState storage v = vaults[sender];
        v.payer = sender;
        v.lockedAmount += msg.value;

        emit VaultFunded(sender, msg.value, v.lockedAmount);
    }

    /**
     * @notice Withdraw unspent ETH back to the Payer's wallet
     */
    function withdrawVault(uint256 amount) external nonReentrant {
        address sender = _msgSender();
        VaultState storage v = vaults[sender];
        require(v.lockedAmount >= v.totalSettled + amount, "PollarVault: insufficient unlocked balance");

        v.lockedAmount -= amount;
        (bool success, ) = payable(sender).call{value: amount}("");
        require(success, "PollarVault: transfer failed");

        emit VaultWithdrawn(sender, amount, v.lockedAmount - v.totalSettled);
    }

    // ==========================================
    // 2. ERC-20 Token Deposit & Withdraw (USDC, USDT)
    // ==========================================

    /**
     * @notice Standard deposit: Payer calls approve() then depositTokenVault()
     */
    function depositTokenVault(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "PollarVault: invalid token address");
        require(amount > 0, "PollarVault: amount must be > 0");
        address sender = _msgSender();

        bool success = IERC20(token).transferFrom(sender, address(this), amount);
        require(success, "PollarVault: ERC-20 transferFrom failed");

        VaultState storage v = tokenVaults[sender][token];
        v.payer = sender;
        v.lockedAmount += amount;

        emit TokenVaultFunded(sender, token, amount, v.lockedAmount);
    }

    /**
     * @notice 100% Gasless Deposit via EIP-3009 (Circle USDC receiveWithAuthorization)
     * Anyone (Relayer) can broadcast this; funds are securely pulled from `from` directly to the vault.
     */
    function depositTokenWithAuthorization(
        address token,
        address from,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(token != address(0), "PollarVault: invalid token address");
        require(from != address(0), "PollarVault: invalid from address");
        require(amount > 0, "PollarVault: amount must be > 0");

        // Atomically pull funds using user's EIP-3009 signature
        IERC3009(token).receiveWithAuthorization(
            from,
            address(this),
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        VaultState storage vState = tokenVaults[from][token];
        vState.payer = from;
        vState.lockedAmount += amount;

        emit TokenVaultFunded(from, token, amount, vState.lockedAmount);
    }

    /**
     * @notice 100% Gasless Deposit via EIP-2612 (permit + transferFrom)
     * Anyone (Relayer) can broadcast this on behalf of `from`.
     */
    function depositTokenWithPermit(
        address token,
        address from,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(token != address(0), "PollarVault: invalid token address");
        require(from != address(0), "PollarVault: invalid from address");
        require(amount > 0, "PollarVault: amount must be > 0");

        // 1. Execute EIP-2612 permit approval
        IERC20Permit(token).permit(from, address(this), amount, deadline, v, r, s);

        // 2. Transfer tokens to vault
        bool success = IERC20(token).transferFrom(from, address(this), amount);
        require(success, "PollarVault: transferFrom failed");

        VaultState storage vState = tokenVaults[from][token];
        vState.payer = from;
        vState.lockedAmount += amount;

        emit TokenVaultFunded(from, token, amount, vState.lockedAmount);
    }

    /**
     * @notice Withdraw unspent ERC-20 tokens back to the Payer's wallet
     */
    function withdrawTokenVault(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "PollarVault: invalid token address");
        address sender = _msgSender();
        VaultState storage v = tokenVaults[sender][token];
        require(v.lockedAmount >= v.totalSettled + amount, "PollarVault: insufficient unlocked token balance");

        v.lockedAmount -= amount;
        bool success = IERC20(token).transfer(sender, amount);
        require(success, "PollarVault: ERC-20 transfer failed");

        emit TokenVaultWithdrawn(sender, token, amount, v.lockedAmount - v.totalSettled);
    }

    // ==========================================
    // 3. Batch Settlements (Can be called by Relayer)
    // ==========================================

    /**
     * @notice Settle an aggregated batch of offline transactions in Native ETH
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

        v.totalSettled += settleAmount;
        v.lastMerkleRoot = merkleRoot;
        v.nonce = batchNonce;

        (bool success, ) = payee.call{value: settleAmount}("");
        require(success, "PollarVault: payment to payee failed");

        emit BatchSettled(payer, payee, settleAmount, merkleRoot, batchNonce);
    }

    /**
     * @notice Settle an aggregated batch of offline transactions in ERC-20 Tokens (USDC / USDT)
     * Anyone (Merchant or Relayer) can broadcast this settlement; tokens transfer strictly from payer's vault to payee.
     */
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

    // ==========================================
    // 4. View Queries
    // ==========================================

    /**
     * @notice Query Native ETH vault state
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
        return (v.payer, v.lockedAmount, v.totalSettled, avail, v.lastMerkleRoot, v.nonce);
    }

    /**
     * @notice Query ERC-20 Token vault state
     */
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
