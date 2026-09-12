package pollarcore

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
)

// MerkleNode represents a single node in the cryptographic Merkle Tree
type MerkleNode struct {
	Hash   string      `json:"hash"`
	Left   *MerkleNode `json:"left,omitempty"`
	Right  *MerkleNode `json:"right,omitempty"`
	TxData *DualSignedTransaction `json:"txData,omitempty"`
	IsLeaf bool        `json:"isLeaf"`
	Index  int         `json:"index"`
}

// MerkleProofStep represents one step in a Merkle inclusion proof
type MerkleProofStep struct {
	Hash     string `json:"hash"`
	Position string `json:"position"` // "left" or "right"
}

// MerkleProof contains the audit path to prove a transaction exists in the Merkle Root
type MerkleProof struct {
	TxHash   string            `json:"txHash"`
	LeafHash string            `json:"leafHash"`
	RootHash string            `json:"rootHash"`
	Index    int               `json:"index"`
	Steps    []MerkleProofStep `json:"steps"`
}

// MerkleTree structure maintaining transaction integrity
type MerkleTree struct {
	Root         *MerkleNode              `json:"root"`
	Leaves       []*MerkleNode            `json:"leaves"`
	Transactions []*DualSignedTransaction `json:"transactions"`
	RootHash     string                   `json:"rootHash"`
}

// HashPair computes SHA256(leftHash + rightHash)
func HashPair(left, right string) string {
	combined := left + right
	hash := sha256.Sum256([]byte(combined))
	return hex.EncodeToString(hash[:])
}

// ComputeLeafHash calculates canonical leaf hash for an offline transaction
func ComputeLeafHash(tx *DualSignedTransaction) string {
	raw := fmt.Sprintf("%s:%d:%.6f:%s:%s", 
		tx.TxHash, 
		tx.Payload.Nonce, 
		tx.Payload.Amount, 
		tx.PayerSignature, 
		tx.PayeeSignature,
	)
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}

// NewMerkleTree constructs a Merkle Tree from an array of dual-signed transactions
func NewMerkleTree(transactions []*DualSignedTransaction) *MerkleTree {
	if len(transactions) == 0 {
		emptyHash := hex.EncodeToString(sha256.New().Sum(nil))
		return &MerkleTree{
			Root:         &MerkleNode{Hash: emptyHash, IsLeaf: true},
			Leaves:       []*MerkleNode{},
			Transactions: []*DualSignedTransaction{},
			RootHash:     emptyHash,
		}
	}

	leaves := make([]*MerkleNode, len(transactions))
	for i, tx := range transactions {
		leafHash := ComputeLeafHash(tx)
		tx.MerkleLeafHash = leafHash
		leaves[i] = &MerkleNode{
			Hash:   leafHash,
			TxData: tx,
			IsLeaf: true,
			Index:  i,
		}
	}

	root := buildTreeLevel(leaves)
	return &MerkleTree{
		Root:         root,
		Leaves:       leaves,
		Transactions: transactions,
		RootHash:     root.Hash,
	}
}

func buildTreeLevel(nodes []*MerkleNode) *MerkleNode {
	if len(nodes) == 0 {
		return nil
	}
	if len(nodes) == 1 {
		return nodes[0]
	}

	var parentNodes []*MerkleNode
	for i := 0; i < len(nodes); i += 2 {
		left := nodes[i]
		var right *MerkleNode
		if i+1 < len(nodes) {
			right = nodes[i+1]
		} else {
			// Odd number of elements: duplicate the last node to balance tree
			right = &MerkleNode{
				Hash:   left.Hash,
				IsLeaf: left.IsLeaf,
				Index:  left.Index,
			}
		}

		parentHash := HashPair(left.Hash, right.Hash)
		parent := &MerkleNode{
			Hash:   parentHash,
			Left:   left,
			Right:  right,
			IsLeaf: false,
		}
		parentNodes = append(parentNodes, parent)
	}

	return buildTreeLevel(parentNodes)
}

// AddTransaction appends a new transaction and recalculates the Merkle root dynamically
func (mt *MerkleTree) AddTransaction(tx *DualSignedTransaction) string {
	mt.Transactions = append(mt.Transactions, tx)
	leafHash := ComputeLeafHash(tx)
	tx.MerkleLeafHash = leafHash
	newLeaf := &MerkleNode{
		Hash:   leafHash,
		TxData: tx,
		IsLeaf: true,
		Index:  len(mt.Leaves),
	}
	mt.Leaves = append(mt.Leaves, newLeaf)
	mt.Root = buildTreeLevel(mt.Leaves)
	mt.RootHash = mt.Root.Hash
	return mt.RootHash
}

// GenerateProof creates an inclusion proof for a transaction index
func (mt *MerkleTree) GenerateProof(txIndex int) (*MerkleProof, error) {
	if txIndex < 0 || txIndex >= len(mt.Leaves) {
		return nil, errors.New("transaction index out of range")
	}

	targetLeaf := mt.Leaves[txIndex]
	var steps []MerkleProofStep

	currentNodes := mt.Leaves
	currentIndex := txIndex

	for len(currentNodes) > 1 {
		var nextLevel []*MerkleNode
		for i := 0; i < len(currentNodes); i += 2 {
			left := currentNodes[i]
			var right *MerkleNode
			if i+1 < len(currentNodes) {
				right = currentNodes[i+1]
			} else {
				right = left
			}

			if i == currentIndex || i+1 == currentIndex {
				if currentIndex%2 == 0 {
					// Target is left, sibling is right
					steps = append(steps, MerkleProofStep{
						Hash:     right.Hash,
						Position: "right",
					})
				} else {
					// Target is right, sibling is left
					steps = append(steps, MerkleProofStep{
						Hash:     left.Hash,
						Position: "left",
					})
				}
			}

			parentHash := HashPair(left.Hash, right.Hash)
			nextLevel = append(nextLevel, &MerkleNode{Hash: parentHash})
		}
		currentIndex /= 2
		currentNodes = nextLevel
	}

	return &MerkleProof{
		TxHash:   targetLeaf.TxData.TxHash,
		LeafHash: targetLeaf.Hash,
		RootHash: mt.RootHash,
		Index:    txIndex,
		Steps:    steps,
	}, nil
}

// VerifyProof verifies that a given transaction leaf matches the root hash via proof steps
func VerifyProof(proof *MerkleProof) bool {
	currentHash := proof.LeafHash
	for _, step := range proof.Steps {
		if step.Position == "left" {
			currentHash = HashPair(step.Hash, currentHash)
		} else {
			currentHash = HashPair(currentHash, step.Hash)
		}
	}
	return currentHash == proof.RootHash
}
