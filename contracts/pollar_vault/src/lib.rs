#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    ExceededLimit = 1,
    CannotSendToSelf = 2,
    InvalidAmount = 3,
}

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

        if initial_amount <= 0 {
            panic!("Initial amount must be greater than zero");
        }

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

        // Validar que no se liquiden transacciones a la misma wallet que emite o posee la bóveda
        if state.payer == payee {
            panic!("Cannot send to self: payee wallet cannot be the same as payer/vault wallet");
        }

        // Validar que el submitter no sea el payee si submitter es el payer
        if submitter == payee && submitter == state.payer {
            panic!("Cannot send to self: submitter and payee cannot be identical to payer");
        }

        // Validar monto positivo
        if settle_amount <= 0 {
            panic!("Settlement amount must be greater than zero");
        }

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

    /// Asigna o incrementa el saldo bloqueado para la bóveda offline
    pub fn allocate_funds(env: Env, payer: Address, amount: i128) {
        payer.require_auth();

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        let mut state: VaultState = match env.storage().instance().get(&VAULT) {
            Some(s) => s,
            None => {
                let initial_root = BytesN::from_array(&env, &[0u8; 32]);
                VaultState {
                    payer: payer.clone(),
                    locked_amount: 0,
                    last_merkle_root: initial_root,
                    total_settled: 0,
                    nonce: 0,
                }
            }
        };

        if state.payer != payer {
            panic!("Caller is not the vault owner");
        }

        state.locked_amount += amount;
        env.storage().instance().set(&VAULT, &state);

        env.events().publish(
            (symbol_short!("vault"), symbol_short!("alloc")),
            (payer, amount, state.locked_amount),
        );
    }

    /// Devuelve saldo no gastado de la bóveda offline a la cuenta principal
    pub fn reclaim_funds(env: Env, payer: Address, amount: i128) {
        payer.require_auth();

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        let mut state: VaultState = env.storage().instance().get(&VAULT).unwrap();

        if state.payer != payer {
            panic!("Caller is not the vault owner");
        }

        let unspent = state.locked_amount - state.total_settled;
        if amount > unspent {
            panic!("Cannot reclaim more than unspent offline vault balance");
        }

        state.locked_amount -= amount;
        env.storage().instance().set(&VAULT, &state);

        env.events().publish(
            (symbol_short!("vault"), symbol_short!("reclaim")),
            (payer, amount, state.locked_amount),
        );
    }

    /// Consulta el estado actual de la bóveda offline
    pub fn get_vault(env: Env) -> VaultState {
        env.storage().instance().get(&VAULT).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_init_and_settle_success() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PollarOfflineVaultContract);
        let client = PollarOfflineVaultContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let payee = Address::generate(&env);

        env.mock_all_auths();

        client.init_vault(&payer, &1000);
        let vault = client.get_vault();
        assert_eq!(vault.payer, payer);
        assert_eq!(vault.locked_amount, 1000);
        assert_eq!(vault.total_settled, 0);

        let merkle_root = BytesN::from_array(&env, &[1u8; 32]);
        client.settle_batch(&payee, &payee, &350, &merkle_root, &1);

        let updated = client.get_vault();
        assert_eq!(updated.total_settled, 350);
        assert_eq!(updated.last_merkle_root, merkle_root);
        assert_eq!(updated.nonce, 1);
    }

    #[test]
    #[should_panic(expected = "Cannot send to self: payee wallet cannot be the same as payer/vault wallet")]
    fn test_prevent_sending_to_same_wallet_that_emits() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PollarOfflineVaultContract);
        let client = PollarOfflineVaultContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);

        env.mock_all_auths();

        client.init_vault(&payer, &1000);

        let merkle_root = BytesN::from_array(&env, &[2u8; 32]);
        // Intento de liquidar hacia la misma wallet pagadora/emisora
        client.settle_batch(&payer, &payer, &200, &merkle_root, &1);
    }

    #[test]
    #[should_panic(expected = "Exceeded locked offline vault limit")]
    fn test_prevent_exceeding_locked_amount() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PollarOfflineVaultContract);
        let client = PollarOfflineVaultContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let payee = Address::generate(&env);

        env.mock_all_auths();

        client.init_vault(&payer, &500);

        let merkle_root = BytesN::from_array(&env, &[3u8; 32]);
        client.settle_batch(&payee, &payee, &600, &merkle_root, &1);
    }
}
