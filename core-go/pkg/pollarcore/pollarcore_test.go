package pollarcore

import (
	"testing"
)

func TestPollarCoreFlow(t *testing.T) {
	// 1. Generate Keypairs for Payer and Payee
	payerKeys, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("Failed to generate payer keys: %v", err)
	}

	payeeKeys, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("Failed to generate payee keys: %v", err)
	}

	// 2. Initialize Offline Vault for Payer (100 USDT Main, allocate 15 USDT offline)
	engine := NewPollarEngine(payerKeys.PublicKey, "USDT", 100.0)
	err = engine.Vault.AllocateOfflineFunds(15.0)
	if err != nil {
		t.Fatalf("Failed to allocate offline funds: %v", err)
	}

	if engine.Vault.AvailableOffline() != 15.0 {
		t.Fatalf("Expected 15.0 available offline, got %f", engine.Vault.AvailableOffline())
	}

	// 3. Payer creates transaction 1 (5.0 USDT)
	payloadJSON1, err := engine.CreatePaymentPayloadJSON(payeeKeys.PublicKey, 5.0, "Café y Snack")
	if err != nil {
		t.Fatalf("Payer failed to create tx 1: %v", err)
	}

	signedTxJSON1, err := SignAndPackageTransaction(payloadJSON1, payerKeys.PrivateKey)
	if err != nil {
		t.Fatalf("Payer failed to sign tx 1: %v", err)
	}

	// 4. Payee processes and counter-signs transaction 1
	counterSignedJSON1, err := engine.ProcessAndCounterSign(signedTxJSON1, payeeKeys.PrivateKey)
	if err != nil {
		t.Fatalf("Payee failed to counter-sign tx 1: %v", err)
	}
	if counterSignedJSON1 == "" {
		t.Fatal("Expected counter-signed tx JSON")
	}

	// 5. Payer creates transaction 2 (8.0 USDT)
	payloadJSON2, err := engine.CreatePaymentPayloadJSON(payeeKeys.PublicKey, 8.0, "Almuerzo")
	if err != nil {
		t.Fatalf("Payer failed to create tx 2: %v", err)
	}

	signedTxJSON2, err := SignAndPackageTransaction(payloadJSON2, payerKeys.PrivateKey)
	if err != nil {
		t.Fatalf("Payer failed to sign tx 2: %v", err)
	}

	_, err = engine.ProcessAndCounterSign(signedTxJSON2, payeeKeys.PrivateKey)
	if err != nil {
		t.Fatalf("Payee failed to counter-sign tx 2: %v", err)
	}

	// 6. Test limit enforcement: Attempting to spend 5.0 USDT when only 2.0 USDT left (15 - 5 - 8 = 2)
	_, err = engine.CreatePaymentPayloadJSON(payeeKeys.PublicKey, 5.0, "Gasto excesivo")
	if err == nil {
		t.Fatal("Expected error spending more than available offline limit, but got none")
	}

	// 7. Verify Merkle Tree integrity
	if len(engine.MerkleTree.Transactions) != 2 {
		t.Fatalf("Expected 2 transactions in Merkle tree, got %d", len(engine.MerkleTree.Transactions))
	}

	rootHash := engine.GetMerkleRootHash()
	if rootHash == "" {
		t.Fatal("Expected non-empty Merkle root hash")
	}

	// 8. Generate and verify Merkle Proof for tx index 0
	proof, err := engine.MerkleTree.GenerateProof(0)
	if err != nil {
		t.Fatalf("Failed to generate Merkle proof: %v", err)
	}

	if !VerifyProof(proof) {
		t.Fatal("Merkle inclusion proof verification failed")
	}

	// 9. Test Batch Building
	batch, err := BuildStellarBatch(engine.MerkleTree.Transactions, payeeKeys.PublicKey)
	if err != nil {
		t.Fatalf("Failed to build Stellar batch: %v", err)
	}
	if batch.TotalAmount != 13.0 {
		t.Fatalf("Expected total batch amount 13.0, got %f", batch.TotalAmount)
	}

	stellarTxHash, err := SimulateStellarBroadcast(batch, payeeKeys.PublicKey)
	if err != nil || stellarTxHash == "" {
		t.Fatalf("Failed to broadcast batch to Stellar: %v", err)
	}
}
