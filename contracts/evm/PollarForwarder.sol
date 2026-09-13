// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PollarForwarder
 * @notice Standard ERC-2771 Trusted Forwarder and Meta-Transaction Relayer for Pollar.
 * Enables zero-gas user transactions:
 * 1. User signs an off-chain EIP-712 ForwardRequest.
 * 2. Any Relayer (sponsor / server / paymaster) broadcasts the request and pays the gas.
 * 3. Forwarder verifies the user's signature, nonces, and forwards the calldata with the user's address appended.
 */
contract PollarForwarder {
    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        uint256 deadline;
        bytes data;
    }

    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 public constant TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint256 deadline,bytes data)"
    );

    mapping(address => uint256) private _nonces;

    event Forwarded(address indexed from, address indexed to, bool success, bytes returnData);

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("PollarForwarder")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Get current nonce for a user account
     */
    function getNonce(address from) external view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @notice Verify whether a ForwardRequest has a valid signature from `req.from`
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        if (req.deadline < block.timestamp) {
            return false;
        }
        if (req.nonce != _nonces[req.from]) {
            return false;
        }

        bytes32 structHash = keccak256(
            abi.encode(
                TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                req.deadline,
                keccak256(req.data)
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        address signer = _recover(digest, signature);
        return signer != address(0) && signer == req.from;
    }

    /**
     * @notice Execute a meta-transaction on behalf of `req.from`
     * Appends `req.from` (20 bytes) to the calldata as specified by ERC-2771.
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool success, bytes memory returnData)
    {
        require(req.deadline >= block.timestamp, "PollarForwarder: request expired");
        require(req.nonce == _nonces[req.from], "PollarForwarder: invalid nonce");
        require(verify(req, signature), "PollarForwarder: signature mismatch");

        _nonces[req.from]++;

        // ERC-2771: Append `from` address to the end of data
        bytes memory callData = abi.encodePacked(req.data, req.from);

        uint256 gasLimit = req.gas > 0 ? req.gas : gasleft() - 5000;
        (success, returnData) = req.to.call{gas: gasLimit, value: req.value}(callData);

        emit Forwarded(req.from, req.to, success, returnData);
        return (success, returnData);
    }

    /**
     * @notice Batch execute multiple meta-transactions in a single on-chain transaction
     */
    function executeBatch(ForwardRequest[] calldata reqs, bytes[] calldata signatures)
        external
        payable
        returns (bool[] memory successes, bytes[] memory returnDatas)
    {
        require(reqs.length == signatures.length, "PollarForwarder: length mismatch");

        successes = new bool[](reqs.length);
        returnDatas = new bytes[](reqs.length);

        for (uint256 i = 0; i < reqs.length; i++) {
            (successes[i], returnDatas[i]) = execute(reqs[i], signatures[i]);
        }
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(digest, v, r, s);
    }

    receive() external payable {}
}
