package pollarcore

import (
	"encoding/json"
	"errors"
	"fmt"
)

// PollarEngine is the main struct exported for GoMobile (Android AAR / iOS Framework)
type PollarEngine struct {
	Vault      *OfflineVault
	MerkleTree *MerkleTree
}

// NewPollarEngine initializes a new engine instance for GoMobile
func NewPollarEngine(ownerPubKey, assetCode string, initialMainBalance float64) *PollarEngine {
	vault := NewOfflineVault(ownerPubKey, assetCode, initialMainBalance)
	tree := NewMerkleTree([]*DualSignedTransaction{})
	return &PollarEngine{
		Vault:      vault,
		MerkleTree: tree,
	}
}

// GenerateNewKeyPairJSON creates an Ed25519 keypair and returns JSON string
func GenerateNewKeyPairJSON() (string, error) {
	kp, err := GenerateKeyPair()
	if err != nil {
		return "", err
	}
	bytes, err := json.Marshal(kp)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// CreatePaymentPayloadJSON generates a payer payload
func (e *PollarEngine) CreatePaymentPayloadJSON(payeePubKey string, amount float64, memo string) (string, error) {
	if payeePubKey == e.Vault.OwnerPublicKey {
		return "", errors.New("cannot send payment to the same wallet: payee is identical to payer")
	}

	nonce, err := e.Vault.AuthorizeAndDeductPayment(amount)
	if err != nil {
		return "", err
	}

	payload := TransactionPayload{
		ID:        fmt.Sprintf("TX-%d-%d", nonce, e.Vault.LastUpdatedAt),
		Payer:     e.Vault.OwnerPublicKey,
		Payee:     payeePubKey,
		Amount:    amount,
		Asset:     e.Vault.AssetCode,
		Nonce:     nonce,
		Memo:      memo,
		Timestamp: e.Vault.LastUpdatedAt,
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// SignAndPackageTransaction signs the payload and returns JSON
func SignAndPackageTransaction(payloadJSON, payerPrivKeyHex string) (string, error) {
	var payload TransactionPayload
	if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
		return "", fmt.Errorf("invalid payload JSON: %w", err)
	}

	txHash, payerSig, err := SignTransactionPayload(&payload, payerPrivKeyHex)
	if err != nil {
		return "", err
	}

	tx := DualSignedTransaction{
		Payload:        payload,
		TxHash:         txHash,
		PayerSignature: payerSig,
		Status:         "PENDING_COUNTER_SIGN",
	}

	bytes, err := json.Marshal(tx)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ProcessAndCounterSign executes Payee side verification and counter-signature
func (e *PollarEngine) ProcessAndCounterSign(txJSON, payeePrivKeyHex string) (string, error) {
	var tx DualSignedTransaction
	if err := json.Unmarshal([]byte(txJSON), &tx); err != nil {
		return "", fmt.Errorf("invalid tx JSON: %w", err)
	}

	if tx.Payload.Payer == tx.Payload.Payee {
		return "", errors.New("invalid transaction: payer and payee cannot be the same wallet")
	}

	// Counter-sign receipt
	payeeSig, err := CounterSignReceipt(tx.TxHash, tx.PayerSignature, payeePrivKeyHex)
	if err != nil {
		return "", err
	}

	tx.PayeeSignature = payeeSig
	tx.Status = "VERIFIED_DUAL"

	// Verify both signatures
	valid, err := VerifyDualSignedTransaction(&tx)
	if !valid || err != nil {
		return "", fmt.Errorf("dual signature verification failed: %w", err)
	}

	// Add to Merkle Tree
	e.MerkleTree.AddTransaction(&tx)

	bytes, err := json.Marshal(tx)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// GetMerkleRootHash returns the current Merkle root hash
func (e *PollarEngine) GetMerkleRootHash() string {
	if e.MerkleTree == nil {
		return ""
	}
	return e.MerkleTree.RootHash
}

// GetVaultStatusJSON returns current vault state
func (e *PollarEngine) GetVaultStatusJSON() (string, error) {
	bytes, err := json.Marshal(e.Vault)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}
