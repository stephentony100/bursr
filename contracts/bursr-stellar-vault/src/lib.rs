//! Bursr vault on Stellar.
//!
//! One instance per business. It holds the business's USDC and enforces the
//! owner's rules: only approved payees, a per-payment cap, a 7-day cap, an
//! emergency stop, and no double payment for the same key. The agent key can
//! only call `pay`; every rule change and withdrawal needs the owner.
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env, Vec,
};

/// Length of the spending window, in seconds (7 days).
pub const WEEK: u64 = 604_800;

/// About 5 seconds per ledger.
const DAY_IN_LEDGERS: u32 = 17_280;
/// Keep entries alive for 30 days; extend again once fewer than 29 remain.
const BUMP_TO: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = BUMP_TO - DAY_IN_LEDGERS;

/// Contract error codes. The numbers are an interface the web app depends on.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    BadAmount = 1,
    AlreadyPaid = 2,
    Frozen = 3,
    NotPayee = 4,
    OverPaymentCap = 5,
    OverWeeklyCap = 6,
    LowBalance = 7,
    BadLimits = 8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Status {
    pub owner: Address,
    pub agent: Address,
    pub token: Address,
    pub per_payment_cap: i128,
    pub weekly_cap: i128,
    pub frozen: bool,
    pub window_start: u64,
    /// Spent in the current window; 0 if the window has run out.
    pub spent: i128,
    /// Token balance held by the vault.
    pub balance: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct Config {
    owner: Address,
    agent: Address,
    token: Address,
    per_payment_cap: i128,
    weekly_cap: i128,
    frozen: bool,
    window_start: u64,
    spent: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Payee(Address),
    Paid(BytesN<32>),
}

/// Published on every payment: topics `("paid", payee)`, data `[key, amount]`.
#[contractevent(topics = ["paid"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Paid {
    #[topic]
    pub payee: Address,
    pub key: BytesN<32>,
    pub amount: i128,
}

fn limits_ok(per: i128, weekly: i128) -> bool {
    per > 0 && weekly > 0 && per <= weekly
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

fn load(env: &Env) -> Config {
    bump_instance(env);
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn save(env: &Env, cfg: &Config) {
    env.storage().instance().set(&DataKey::Config, cfg);
}

fn set_persistent(env: &Env, key: &DataKey) {
    let p = env.storage().persistent();
    p.set(key, &true);
    p.extend_ttl(key, BUMP_THRESHOLD, BUMP_TO);
}

fn add_payees(env: &Env, payees: &Vec<Address>) {
    for addr in payees.iter() {
        set_persistent(env, &DataKey::Payee(addr));
    }
}

fn window_expired(env: &Env, cfg: &Config) -> bool {
    env.ledger().timestamp() >= cfg.window_start.saturating_add(WEEK)
}

fn balance_of_vault(env: &Env, cfg: &Config) -> i128 {
    token::Client::new(env, &cfg.token).balance(&env.current_contract_address())
}

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    /// Sets up the vault, not frozen, with the starting approved payees.
    pub fn __constructor(
        env: Env,
        owner: Address,
        agent: Address,
        token: Address,
        per_payment_cap: i128,
        weekly_cap: i128,
        payees: Vec<Address>,
    ) {
        if !limits_ok(per_payment_cap, weekly_cap) {
            panic_with_error!(&env, Error::BadLimits);
        }
        save(
            &env,
            &Config {
                owner,
                agent,
                token,
                per_payment_cap,
                weekly_cap,
                frozen: false,
                window_start: 0,
                spent: 0,
            },
        );
        bump_instance(&env);
        add_payees(&env, &payees);
    }

    /// Owner only: caps, emergency stop and approved-list changes in one
    /// signature. Adds are applied before removes.
    pub fn update(
        env: Env,
        per_payment_cap: i128,
        weekly_cap: i128,
        frozen: bool,
        add: Vec<Address>,
        remove: Vec<Address>,
    ) -> Result<(), Error> {
        let mut cfg = load(&env);
        cfg.owner.require_auth();
        if !limits_ok(per_payment_cap, weekly_cap) {
            return Err(Error::BadLimits);
        }
        cfg.per_payment_cap = per_payment_cap;
        cfg.weekly_cap = weekly_cap;
        cfg.frozen = frozen;
        save(&env, &cfg);
        add_payees(&env, &add);
        for addr in remove.iter() {
            env.storage().persistent().remove(&DataKey::Payee(addr));
        }
        Ok(())
    }

    /// Owner only: moves money out of the vault. Works while frozen.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        let cfg = load(&env);
        cfg.owner.require_auth();
        if amount <= 0 {
            return Err(Error::BadAmount);
        }
        if balance_of_vault(&env, &cfg) < amount {
            return Err(Error::LowBalance);
        }
        token::Client::new(&env, &cfg.token).transfer(&env.current_contract_address(), &to, &amount);
        Ok(())
    }

    /// Owner only: replaces the agent key.
    pub fn set_agent(env: Env, agent: Address) {
        let mut cfg = load(&env);
        cfg.owner.require_auth();
        cfg.agent = agent;
        save(&env, &cfg);
    }

    /// Agent only: pays one approved payee. Returns the window's new total.
    pub fn pay(env: Env, key: BytesN<32>, payee: Address, amount: i128) -> Result<i128, Error> {
        let mut cfg = load(&env);
        cfg.agent.require_auth();

        if amount <= 0 {
            return Err(Error::BadAmount);
        }
        let paid_key = DataKey::Paid(key.clone());
        if env.storage().persistent().has(&paid_key) {
            return Err(Error::AlreadyPaid);
        }
        if cfg.frozen {
            return Err(Error::Frozen);
        }
        if !env.storage().persistent().has(&DataKey::Payee(payee.clone())) {
            return Err(Error::NotPayee);
        }
        if amount > cfg.per_payment_cap {
            return Err(Error::OverPaymentCap);
        }
        if window_expired(&env, &cfg) {
            cfg.window_start = env.ledger().timestamp();
            cfg.spent = 0;
        }
        let spent = match cfg.spent.checked_add(amount) {
            Some(s) if s <= cfg.weekly_cap => s,
            _ => return Err(Error::OverWeeklyCap),
        };
        if balance_of_vault(&env, &cfg) < amount {
            return Err(Error::LowBalance);
        }

        set_persistent(&env, &paid_key);
        cfg.spent = spent;
        save(&env, &cfg);
        token::Client::new(&env, &cfg.token).transfer(
            &env.current_contract_address(),
            &payee,
            &amount,
        );
        Paid { payee, key, amount }.publish(&env);
        Ok(spent)
    }

    /// Anyone: the vault's rules, this window's spending and its balance.
    pub fn status(env: Env) -> Status {
        let cfg = load(&env);
        let spent = if window_expired(&env, &cfg) { 0 } else { cfg.spent };
        let balance = balance_of_vault(&env, &cfg);
        Status {
            owner: cfg.owner,
            agent: cfg.agent,
            token: cfg.token,
            per_payment_cap: cfg.per_payment_cap,
            weekly_cap: cfg.weekly_cap,
            frozen: cfg.frozen,
            window_start: cfg.window_start,
            spent,
            balance,
        }
    }

    /// Anyone: is this address on the approved list?
    pub fn is_payee(env: Env, addr: Address) -> bool {
        bump_instance(&env);
        env.storage().persistent().has(&DataKey::Payee(addr))
    }

    /// Anyone: has a payment with this key already gone out?
    pub fn paid(env: Env, key: BytesN<32>) -> bool {
        bump_instance(&env);
        env.storage().persistent().has(&DataKey::Paid(key))
    }
}

mod test;
