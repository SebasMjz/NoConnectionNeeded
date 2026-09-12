package pollarcore

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
)

// KeyPair represents an Ed25519 cryptographic keypair compatible with Stellar
type KeyPair struct {
	PublicKey  string `json:"publicKey"`
	PrivateKey string `json:"privateKey"`
}

// TransactionPayload represents the offline payment payload created by Payer
type TransactionPayload struct {
	ID        string  `json:"id"`
	Payer     string  `json:"payer"`
	Payee     string  `json:"payee"`
	Amount    float64 `json:"amount"`
	Asset     string  `json:"asset"`     // e.g., "USDT", "XLM", "POLLAR"
	Nonce     int64   `json:"nonce"`     // Incremental sequence nonce of the offline vault
	Memo      string  `json:"memo"`
	Timestamp int64   `json:"timestamp"`
}

// DualSignedTransaction represents the verified transaction signed by both parties
type DualSignedTransaction struct {
	Payload        TransactionPayload `json:"payload"`
	TxHash         string             `json:"txHash"`
	PayerSignature string             `json:"payerSignature"`
	PayeeSignature string             `json:"payeeSignature"`
	MerkleLeafHash string             `json:"merkleLeafHash"`
	Status         string             `json:"status"` // "PENDING_OFFLINE", "SYNCED_ONCHAIN", "VERIFIED_DUAL"
	SyncedBy       string             `json:"syncedBy,omitempty"`
	SyncedAt       int64              `json:"syncedAt,omitempty"`
	StellarTxHash  string             `json:"stellarTxHash,omitempty"`
}

// GenerateKeyPair creates a new Ed25519 keypair
func GenerateKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ed25519 keypair: %w", err)
	}
	return &KeyPair{
		PublicKey:  hex.EncodeToString(pub),
		PrivateKey: hex.EncodeToString(priv),
	}, nil
}

// ComputeTxHash calculates the canonical SHA-256 hash of the transaction payload
func ComputeTxHash(payload *TransactionPayload) (string, error) {
	canonicalBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(canonicalBytes)
	return hex.EncodeToString(hash[:]), nil
}

// SignTransactionPayload signs the transaction payload using the Payer's private key
func SignTransactionPayload(payload *TransactionPayload, privKeyHex string) (string, string, error) {
	privBytes, err := hex.DecodeString(privKeyHex)
	if err != nil || len(privBytes) != ed25519.PrivateKeySize {
		return "", "", errors.New("invalid ed25519 private key")
	}

	txHash, err := ComputeTxHash(payload)
	if err != nil {
		return "", "", err
	}

	hashBytes, err := hex.DecodeString(txHash)
	if err != nil {
		return "", "", err
	}

	sig := ed25519.Sign(privBytes, hashBytes)
	return txHash, hex.EncodeToString(sig), nil
}

// VerifySignature verifies an Ed25519 signature against a message/hash
func VerifySignature(pubKeyHex, hashHex, sigHex string) bool {
	pubBytes, err := hex.DecodeString(pubKeyHex)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		return false
	}
	hashBytes, err := hex.DecodeString(hashHex)
	if err != nil {
		return false
	}
	sigBytes, err := hex.DecodeString(sigHex)
	if err != nil {
		return false
	}

	return ed25519.Verify(pubBytes, hashBytes, sigBytes)
}

// CounterSignReceipt creates the Payee's cryptographic counter-signature to prevent repudiation
func CounterSignReceipt(txHash, payerSig, payeePrivKeyHex string) (string, error) {
	payeePrivBytes, err := hex.DecodeString(payeePrivKeyHex)
	if err != nil || len(payeePrivBytes) != ed25519.PrivateKeySize {
		return "", errors.New("invalid payee private key")
	}

	// Payee signs the commitment of (TxHash + PayerSignature)
	receiptData := fmt.Sprintf("%s:%s", txHash, payerSig)
	receiptHash := sha256.Sum256([]byte(receiptData))
	payeeSig := ed25519.Sign(payeePrivBytes, receiptHash[:])

	return hex.EncodeToString(payeeSig), nil
}

// VerifyDualSignedTransaction validates both Payer and Payee signatures
func VerifyDualSignedTransaction(tx *DualSignedTransaction) (bool, error) {
	// 1. Verify txHash
	computedHash, err := ComputeTxHash(&tx.Payload)
	if err != nil {
		return false, fmt.Errorf("error computing tx hash: %w", err)
	}
	if computedHash != tx.TxHash {
		return false, errors.New("txHash mismatch: payload has been modified")
	}

	// 2. Verify Payer signature
	if !VerifySignature(tx.Payload.Payer, tx.TxHash, tx.PayerSignature) {
		return false, errors.New("invalid payer signature")
	}

	// 3. Verify Payee counter-signature
	receiptData := fmt.Sprintf("%s:%s", tx.TxHash, tx.PayerSignature)
	receiptHash := sha256.Sum256([]byte(receiptData))
	receiptHashHex := hex.EncodeToString(receiptHash[:])

	if !VerifySignature(tx.Payload.Payee, receiptHashHex, tx.PayeeSignature) {
		return false, errors.New("invalid payee counter-signature")
	}

	return true, nil
}
