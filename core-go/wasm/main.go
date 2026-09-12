//go:build js && wasm
package main

import (
	"encoding/json"
	"pollar-core/pkg/pollarcore"
	"syscall/js"
)

var globalEngines = make(map[string]*pollarcore.PollarEngine)

func generateKeyPairWrapper(this js.Value, args []js.Value) any {
	kp, err := pollarcore.GenerateKeyPair()
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	return map[string]any{
		"publicKey":  kp.PublicKey,
		"privateKey": kp.PrivateKey,
	}
}

func computeTxHashWrapper(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"error": "missing payload JSON argument"}
	}
	var payload pollarcore.TransactionPayload
	if err := json.Unmarshal([]byte(args[0].String()), &payload); err != nil {
		return map[string]any{"error": err.Error()}
	}
	hash, err := pollarcore.ComputeTxHash(&payload)
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	return map[string]any{"hash": hash}
}

func signPayloadWrapper(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return map[string]any{"error": "expected payload JSON and privateKeyHex"}
	}
	var payload pollarcore.TransactionPayload
	if err := json.Unmarshal([]byte(args[0].String()), &payload); err != nil {
		return map[string]any{"error": err.Error()}
	}
	privKey := args[1].String()
	txHash, sig, err := pollarcore.SignTransactionPayload(&payload, privKey)
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	return map[string]any{
		"txHash":    txHash,
		"signature": sig,
	}
}

func counterSignWrapper(this js.Value, args []js.Value) any {
	if len(args) < 3 {
		return map[string]any{"error": "expected txHash, payerSig, and payeePrivKeyHex"}
	}
	txHash := args[0].String()
	payerSig := args[1].String()
	payeePrivKey := args[2].String()

	payeeSig, err := pollarcore.CounterSignReceipt(txHash, payerSig, payeePrivKey)
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	return map[string]any{
		"counterSignature": payeeSig,
	}
}

func verifyDualSignedWrapper(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"error": "expected dualSignedTx JSON"}
	}
	var tx pollarcore.DualSignedTransaction
	if err := json.Unmarshal([]byte(args[0].String()), &tx); err != nil {
		return map[string]any{"error": err.Error()}
	}
	valid, err := pollarcore.VerifyDualSignedTransaction(&tx)
	if err != nil {
		return map[string]any{"valid": false, "error": err.Error()}
	}
	return map[string]any{"valid": valid}
}

func buildMerkleTreeWrapper(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"error": "expected transactions JSON array"}
	}
	var txs []*pollarcore.DualSignedTransaction
	if err := json.Unmarshal([]byte(args[0].String()), &txs); err != nil {
		return map[string]any{"error": err.Error()}
	}
	tree := pollarcore.NewMerkleTree(txs)
	treeJSON, err := json.Marshal(tree)
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	return map[string]any{
		"rootHash": tree.RootHash,
		"treeJSON": string(treeJSON),
	}
}

func main() {
	c := make(chan struct{})

	js.Global().Set("PollarGoEngine", map[string]any{
		"isGoWasmReady":       true,
		"generateKeyPair":     js.FuncOf(generateKeyPairWrapper),
		"computeTxHash":       js.FuncOf(computeTxHashWrapper),
		"signPayload":         js.FuncOf(signPayloadWrapper),
		"counterSignReceipt":  js.FuncOf(counterSignWrapper),
		"verifyDualSignature": js.FuncOf(verifyDualSignedWrapper),
		"buildMerkleTree":     js.FuncOf(buildMerkleTreeWrapper),
	})

	<-c
}
