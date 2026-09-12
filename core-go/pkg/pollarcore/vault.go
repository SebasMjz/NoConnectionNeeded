package pollarcore

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

// OfflineVault manages derived local offline balance with strict cryptographic limits
type OfflineVault struct {
	mu             sync.RWMutex
	OwnerPublicKey string  `json:"ownerPublicKey"`
	AssetCode      string  `json:"assetCode"`      // e.g. "USDT", "XLM", "POLLAR"
	MainBalance    float64 `json:"mainBalance"`    // e.g. 100.0 USDT
	DerivedOffline float64 `json:"derivedOffline"` // Allocated offline limit (e.g. 10.0 USDT)
	SpentOffline   float64 `json:"spentOffline"`   // Accumulated offline expenditures
	CurrentNonce   int64   `json:"currentNonce"`   // Current sequence counter for offline transactions
	LastUpdatedAt  int64   `json:"lastUpdatedAt"`
}

// NewOfflineVault initializes a vault with an initial main balance and derived allocation
func NewOfflineVault(pubKey, asset string, initialMain float64) *OfflineVault {
	return &OfflineVault{
		OwnerPublicKey: pubKey,
		AssetCode:      asset,
		MainBalance:    initialMain,
		DerivedOffline: 0.0,
		SpentOffline:   0.0,
		CurrentNonce:   0,
		LastUpdatedAt:  time.Now().Unix(),
	}
}

// AllocateOfflineFunds derives funds from the main balance to the offline vault
func (v *OfflineVault) AllocateOfflineFunds(amount float64) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if amount <= 0 {
		return errors.New("amount must be greater than zero")
	}

	availableInMain := v.MainBalance - v.DerivedOffline
	if amount > availableInMain {
		return fmt.Errorf("insufficient main wallet balance: requested %.2f, available in main %.2f", amount, availableInMain)
	}

	v.DerivedOffline += amount
	v.LastUpdatedAt = time.Now().Unix()
	return nil
}

// ReturnFundsToMain reclaims unspent offline funds back to main wallet
func (v *OfflineVault) ReturnFundsToMain(amount float64) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	unspentOffline := v.DerivedOffline - v.SpentOffline
	if amount > unspentOffline {
		return fmt.Errorf("cannot return more than unspent offline balance: %.2f", unspentOffline)
	}

	v.DerivedOffline -= amount
	v.LastUpdatedAt = time.Now().Unix()
	return nil
}

// AvailableOffline returns the remaining spendable offline balance
func (v *OfflineVault) AvailableOffline() float64 {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.DerivedOffline - v.SpentOffline
}

// AuthorizeAndDeductPayment validates that an offline payment is within limits and reserves nonce
func (v *OfflineVault) AuthorizeAndDeductPayment(amount float64) (int64, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	available := v.DerivedOffline - v.SpentOffline
	if amount <= 0 {
		return 0, errors.New("payment amount must be greater than zero")
	}
	if amount > available {
		return 0, fmt.Errorf("offline limit exceeded: attempting to spend %.2f but only %.2f available offline", amount, available)
	}

	v.SpentOffline += amount
	v.CurrentNonce++
	v.LastUpdatedAt = time.Now().Unix()
	return v.CurrentNonce, nil
}

// ReconcileOnChainSync updates main balance after on-chain batch settlement
func (v *OfflineVault) ReconcileOnChainSync(settledAmount float64) {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.MainBalance -= settledAmount
	v.DerivedOffline -= settledAmount
	v.SpentOffline -= settledAmount
	if v.SpentOffline < 0 {
		v.SpentOffline = 0
	}
	if v.DerivedOffline < 0 {
		v.DerivedOffline = 0
	}
	v.LastUpdatedAt = time.Now().Unix()
}
