package pollarcore

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// StellarBatchSubmission represents the aggregated payload ready to broadcast to Stellar / Pollar
type StellarBatchSubmission struct {
	BatchID          string                   `json:"batchId"`
	MerkleRoot       string                   `json:"merkleRoot"`
	TransactionCount int                      `json:"transactionCount"`
	TotalAmount      float64                  `json:"totalAmount"`
	Asset            string                   `json:"asset"`
	Transactions     []*DualSignedTransaction `json:"transactions"`
	SubmittedBy      string                   `json:"submittedBy"` // "PAYER" or "PAYEE"
	GeneratedAt      int64                    `json:"generatedAt"`
	Status           string                   `json:"status"`
	StellarMemo      string                   `json:"stellarMemo"` // 32-byte Merkle Root Hex as memo hash
}

// BuildStellarBatch aggregates offline dual-signed transactions into a single atomic batch
func BuildStellarBatch(transactions []*DualSignedTransaction, submitterPubKey string) (*StellarBatchSubmission, error) {
	if len(transactions) == 0 {
		return nil, fmt.Errorf("no transactions to batch")
	}

	mt := NewMerkleTree(transactions)
	var total float64
	asset := transactions[0].Payload.Asset

	for _, tx := range transactions {
		total += tx.Payload.Amount
	}

	batchID := fmt.Sprintf("BATCH-%s-%d", mt.RootHash[:8], time.Now().Unix())
	stellarMemo := mt.RootHash
	if len(stellarMemo) > 32 {
		stellarMemo = stellarMemo[:32]
	}

	return &StellarBatchSubmission{
		BatchID:          batchID,
		MerkleRoot:       mt.RootHash,
		TransactionCount: len(transactions),
		TotalAmount:      total,
		Asset:            asset,
		Transactions:     transactions,
		SubmittedBy:      submitterPubKey,
		GeneratedAt:      time.Now().Unix(),
		Status:           "READY_FOR_BROADCAST",
		StellarMemo:      stellarMemo,
	}, nil
}

// SimulateStellarBroadcast simulates or signs the on-chain submission with SDK Pollar
func SimulateStellarBroadcast(batch *StellarBatchSubmission, submitterPubKey string) (string, error) {
	// Generate deterministic transaction hash on Stellar
	raw := fmt.Sprintf("%s:%s:%d:%s", batch.BatchID, batch.MerkleRoot, batch.GeneratedAt, submitterPubKey)
	hash := sha256.Sum256([]byte(raw))
	stellarTxHash := hex.EncodeToString(hash[:])

	batch.Status = "BROADCASTED_ON_STELLAR"
	for _, tx := range batch.Transactions {
		tx.Status = "SYNCED_ONCHAIN"
		tx.SyncedBy = submitterPubKey
		tx.SyncedAt = time.Now().Unix()
		tx.StellarTxHash = stellarTxHash
	}

	return stellarTxHash, nil
}
