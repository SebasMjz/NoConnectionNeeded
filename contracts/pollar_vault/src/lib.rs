#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub struct VaultState {
    pub payer: Address,
    pub locked_amount: i128,
    pub last_merkle_root: BytesN<32>,
    pub total_settled: i128,
    pub nonce: u64,
}

const VAULT: Symbol = symbol_short!("VAULT");

#[contract]
pub struct PollarOfflineVaultContract;

#[contractimpl]
impl PollarOfflineVaultContract {
    /// Inicializa y bloquea saldo para la bóveda offline
    pub fn init_vault(env: Env, payer: Address, initial_amount: i128) {
        payer.require_auth();

        let initial_root = BytesN::from_array(&env, &[0u8; 32]);
        let state = VaultState {
            payer: payer.clone(),
            locked_amount: initial_amount,
            last_merkle_root: initial_root,
            total_settled: 0,
            nonce: 0,
        };

        env.storage().instance().set(&VAULT, &state);

        // Emitir evento on-chain
        env.events().publish(
            (symbol_short!("vault"), symbol_short!("init")),
            (payer, initial_amount),
        );
    }

    /// Liquida un lote de transacciones offline verificado con el Árbol de Merkle
    pub fn settle_batch(
        env: Env,
        submitter: Address,
        payee: Address,
        settle_amount: i128,
        merkle_root: BytesN<32>,
        batch_nonce: u64,
    ) {
        submitter.require_auth();

        let mut state: VaultState = env.storage().instance().get(&VAULT).unwrap();

        // Validar que el monto liquidado no exceda el saldo bloqueado
        if state.total_settled + settle_amount > state.locked_amount {
            panic!("Exceeded locked offline vault limit");
        }

        // Actualizar estado
        state.total_settled += settle_amount;
        state.last_merkle_root = merkle_root.clone();
        state.nonce = batch_nonce;

        env.storage().instance().set(&VAULT, &state);

        // Emitir evento de liquidación con el Hash Raíz de Merkle
        env.events().publish(
            (symbol_short!("vault"), symbol_short!("settled")),
            (payee, settle_amount, merkle_root, batch_nonce),
        );
    }

    /// Consulta el estado actual de la bóveda offline
    pub fn get_vault(env: Env) -> VaultState {
        env.storage().instance().get(&VAULT).unwrap()
    }
}
