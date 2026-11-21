#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

const PER: i128 = 100_000_000; // $10 at 7 decimals
const WEEKLY: i128 = 500_000_000; // $50
const START: u64 = 1_700_000_000;

struct Setup<'a> {
    env: Env,
    owner: Address,
    agent: Address,
    payee: Address,
    vault: VaultClient<'a>,
    vault_id: Address,
    token: TokenClient<'a>,
}

/// A vault with $100 in it and one approved payee. `mock_all_auths` stays on.
fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = START);

    let owner = Address::generate(&env);
    let agent = Address::generate(&env);
    let payee = Address::generate(&env);
    let admin = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin);
    let token_id = sac.address();

    let vault_id = env.register(
        Vault,
        (
            owner.clone(),
            agent.clone(),
            token_id.clone(),
            PER,
            WEEKLY,
            Vec::<Address>::new(&env),
        ),
    );
    StellarAssetClient::new(&env, &token_id).mint(&vault_id, &1_000_000_000);

    let vault = VaultClient::new(&env, &vault_id);
    vault.update(&PER, &WEEKLY, &false, &vec![&env, payee.clone()], &Vec::new(&env));

    let token = TokenClient::new(&env, &token_id);
    Setup { env, owner, agent, payee, vault, vault_id, token }
}

fn key(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

fn pay_err(s: &Setup, k: u8, payee: &Address, amount: i128) -> Error {
    match s.vault.try_pay(&key(&s.env, k), payee, &amount) {
        Err(Ok(e)) => e,
        other => panic!("expected a contract error, got {:?}", other),
    }
}

#[test]
fn constructor_sets_status() {
    let s = setup();
    let st = s.vault.status();
    assert_eq!(st.owner, s.owner);
    assert_eq!(st.agent, s.agent);
    assert_eq!(st.token, s.token.address);
    assert_eq!(st.per_payment_cap, PER);
    assert_eq!(st.weekly_cap, WEEKLY);
    assert!(!st.frozen);
    assert_eq!(st.window_start, 0);
    assert_eq!(st.spent, 0);
    assert_eq!(st.balance, 1_000_000_000);
    assert!(s.vault.is_payee(&s.payee));
    assert!(!s.vault.is_payee(&s.agent));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn constructor_rejects_per_above_weekly() {
    let env = Env::default();
    let a = Address::generate(&env);
    env.register(Vault, (a.clone(), a.clone(), a, WEEKLY + 1, WEEKLY, Vec::<Address>::new(&env)));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn constructor_rejects_zero_cap() {
    let env = Env::default();
    let a = Address::generate(&env);
    env.register(Vault, (a.clone(), a.clone(), a, 0i128, WEEKLY, Vec::<Address>::new(&env)));
}

#[test]
fn constructor_payee_can_be_paid() {
    let env = Env::default();
    env.mock_all_auths();
    let owner = Address::generate(&env);
    let agent = Address::generate(&env);
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_id = sac.address();
    let vault_id = env.register(
        Vault,
        (owner, agent, token_id.clone(), PER, WEEKLY, vec![&env, p1.clone(), p2.clone()]),
    );
    StellarAssetClient::new(&env, &token_id).mint(&vault_id, &PER);
    let vault = VaultClient::new(&env, &vault_id);
    assert!(vault.is_payee(&p1));
    assert!(vault.is_payee(&p2));
    assert_eq!(vault.pay(&key(&env, 1), &p2, &7), 7);
    assert_eq!(TokenClient::new(&env, &token_id).balance(&p2), 7);
}

#[test]
fn pays_approved_payee_and_moves_balance() {
    let s = setup();
    let spent = s.vault.pay(&key(&s.env, 1), &s.payee, &40_000_000);
    assert_eq!(spent, 40_000_000);
    assert_eq!(s.token.balance(&s.payee), 40_000_000);
    assert_eq!(s.token.balance(&s.vault_id), 960_000_000);
    assert!(s.vault.paid(&key(&s.env, 1)));
    assert!(!s.vault.paid(&key(&s.env, 2)));

    let st = s.vault.status();
    assert_eq!(st.spent, 40_000_000);
    assert_eq!(st.window_start, START);
    assert_eq!(st.balance, 960_000_000);

    // Second payment adds to the week's total.
    assert_eq!(s.vault.pay(&key(&s.env, 2), &s.payee, &PER), 140_000_000);
}

#[test]
fn pay_emits_paid_event() {
    let s = setup();
    let k = key(&s.env, 9);
    s.vault.pay(&k, &s.payee, &5);
    let events = s.env.events().all().filter_by_contract(&s.vault_id);
    let topics: Vec<Val> = (Symbol::new(&s.env, "paid"), s.payee.clone()).into_val(&s.env);
    let data: Val = (k, 5i128).into_val(&s.env);
    assert_eq!(events, vec![&s.env, (s.vault_id.clone(), topics, data)]);
}

#[test]
fn refuses_bad_amount() {
    let s = setup();
    assert_eq!(pay_err(&s, 1, &s.payee, 0), Error::BadAmount);
    assert_eq!(pay_err(&s, 1, &s.payee, -5), Error::BadAmount);
}

#[test]
fn refuses_repeat_key() {
    let s = setup();
    s.vault.pay(&key(&s.env, 1), &s.payee, &10);
    assert_eq!(pay_err(&s, 1, &s.payee, 10), Error::AlreadyPaid);
    assert_eq!(s.token.balance(&s.payee), 10);
}

#[test]
fn refuses_when_frozen() {
    let s = setup();
    s.vault.update(&PER, &WEEKLY, &true, &Vec::new(&s.env), &Vec::new(&s.env));
    assert!(s.vault.status().frozen);
    assert_eq!(pay_err(&s, 1, &s.payee, 10), Error::Frozen);
}

#[test]
fn refuses_unknown_payee() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    assert_eq!(pay_err(&s, 1, &stranger, 10), Error::NotPayee);
}

#[test]
fn removed_payee_is_refused() {
    let s = setup();
    s.vault.update(&PER, &WEEKLY, &false, &Vec::new(&s.env), &vec![&s.env, s.payee.clone()]);
    assert!(!s.vault.is_payee(&s.payee));
    assert_eq!(pay_err(&s, 1, &s.payee, 10), Error::NotPayee);
}

#[test]
fn refuses_over_payment_cap() {
    let s = setup();
    assert_eq!(pay_err(&s, 1, &s.payee, PER + 1), Error::OverPaymentCap);
}

#[test]
fn refuses_over_weekly_cap() {
    let s = setup();
    for i in 0..5u8 {
        s.vault.pay(&key(&s.env, i), &s.payee, &PER);
    }
    assert_eq!(s.vault.status().spent, WEEKLY);
    assert_eq!(pay_err(&s, 9, &s.payee, 1), Error::OverWeeklyCap);
}

#[test]
fn refuses_low_balance() {
    let s = setup();
    // Leave 5 units in the vault.
    s.vault.withdraw(&s.owner, &(1_000_000_000 - 5));
    assert_eq!(pay_err(&s, 1, &s.payee, 6), Error::LowBalance);
    assert_eq!(s.vault.pay(&key(&s.env, 2), &s.payee, &5), 5);
}

#[test]
fn checks_run_in_order() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    s.vault.pay(&key(&s.env, 1), &s.payee, &10);
    s.vault.update(&PER, &WEEKLY, &true, &Vec::new(&s.env), &Vec::new(&s.env));
    // Bad amount beats everything.
    assert_eq!(pay_err(&s, 1, &stranger, 0), Error::BadAmount);
    // A used key beats frozen.
    assert_eq!(pay_err(&s, 1, &stranger, PER * 100), Error::AlreadyPaid);
    // Frozen beats unknown payee.
    assert_eq!(pay_err(&s, 2, &stranger, PER * 100), Error::Frozen);
    s.vault.update(&PER, &WEEKLY, &false, &Vec::new(&s.env), &Vec::new(&s.env));
    // Unknown payee beats the payment cap.
    assert_eq!(pay_err(&s, 2, &stranger, PER * 100), Error::NotPayee);
    // Payment cap beats low balance.
    assert_eq!(pay_err(&s, 2, &s.payee, PER * 100), Error::OverPaymentCap);
}

#[test]
fn weekly_window_resets_after_seven_days() {
    let s = setup();
    for i in 0..5u8 {
        s.vault.pay(&key(&s.env, i), &s.payee, &PER);
    }
    assert_eq!(pay_err(&s, 9, &s.payee, 1), Error::OverWeeklyCap);

    s.env.ledger().with_mut(|l| l.timestamp = START + WEEK - 1);
    assert_eq!(pay_err(&s, 9, &s.payee, 1), Error::OverWeeklyCap);
    assert_eq!(s.vault.status().spent, WEEKLY);

    s.env.ledger().with_mut(|l| l.timestamp = START + WEEK);
    // status shows the reset before anyone pays.
    assert_eq!(s.vault.status().spent, 0);
    assert_eq!(s.vault.pay(&key(&s.env, 9), &s.payee, &PER), PER);
    let st = s.vault.status();
    assert_eq!(st.window_start, START + WEEK);
    assert_eq!(st.spent, PER);
}

#[test]
fn withdraw_works_while_frozen() {
    let s = setup();
    s.vault.update(&PER, &WEEKLY, &true, &Vec::new(&s.env), &Vec::new(&s.env));
    s.vault.withdraw(&s.owner, &300_000_000);
    assert_eq!(s.token.balance(&s.owner), 300_000_000);
    assert_eq!(s.vault.status().balance, 700_000_000);
}

#[test]
fn withdraw_refuses_bad_amount_and_low_balance() {
    let s = setup();
    assert_eq!(s.vault.try_withdraw(&s.owner, &0), Err(Ok(Error::BadAmount)));
    assert_eq!(
        s.vault.try_withdraw(&s.owner, &1_000_000_001),
        Err(Ok(Error::LowBalance))
    );
}

#[test]
fn update_validates_limits() {
    let s = setup();
    let none = Vec::new(&s.env);
    assert_eq!(
        s.vault.try_update(&0, &WEEKLY, &false, &none, &none),
        Err(Ok(Error::BadLimits))
    );
    assert_eq!(
        s.vault.try_update(&PER, &0, &false, &none, &none),
        Err(Ok(Error::BadLimits))
    );
    assert_eq!(
        s.vault.try_update(&(WEEKLY + 1), &WEEKLY, &false, &none, &none),
        Err(Ok(Error::BadLimits))
    );
    s.vault.update(&20, &30, &false, &none, &none);
    let st = s.vault.status();
    assert_eq!((st.per_payment_cap, st.weekly_cap), (20, 30));
    assert_eq!(pay_err(&s, 1, &s.payee, 21), Error::OverPaymentCap);
}

#[test]
fn set_agent_replaces_agent() {
    let s = setup();
    let new_agent = Address::generate(&s.env);
    s.vault.set_agent(&new_agent);
    assert_eq!(s.vault.status().agent, new_agent);
}

// ---- Auth: who may call what ----

#[test]
fn update_without_any_auth_fails() {
    let s = setup();
    s.env.set_auths(&[]);
    let none: Vec<Address> = Vec::new(&s.env);
    assert!(s.vault.try_update(&PER, &WEEKLY, &true, &none, &none).is_err());
    assert!(!s.vault.status().frozen);
}

#[test]
fn update_with_only_agent_auth_fails() {
    let s = setup();
    let none: Vec<Address> = Vec::new(&s.env);
    let stranger = Address::generate(&s.env);
    let add = vec![&s.env, stranger.clone()];
    s.env.mock_auths(&[MockAuth {
        address: &s.agent,
        invoke: &MockAuthInvoke {
            contract: &s.vault_id,
            fn_name: "update",
            args: (PER, WEEKLY, false, add.clone(), none.clone()).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.vault.try_update(&PER, &WEEKLY, &false, &add, &none).is_err());
    assert!(!s.vault.is_payee(&stranger));
}

#[test]
fn update_with_owner_auth_works() {
    let s = setup();
    let none: Vec<Address> = Vec::new(&s.env);
    let stranger = Address::generate(&s.env);
    let add = vec![&s.env, stranger.clone()];
    s.env.mock_auths(&[MockAuth {
        address: &s.owner,
        invoke: &MockAuthInvoke {
            contract: &s.vault_id,
            fn_name: "update",
            args: (PER, WEEKLY, false, add.clone(), none.clone()).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    s.vault.update(&PER, &WEEKLY, &false, &add, &none);
    assert!(s.vault.is_payee(&stranger));
}

#[test]
fn pay_with_only_owner_auth_fails() {
    let s = setup();
    let k = key(&s.env, 1);
    s.env.mock_auths(&[MockAuth {
        address: &s.owner,
        invoke: &MockAuthInvoke {
            contract: &s.vault_id,
            fn_name: "pay",
            args: (k.clone(), s.payee.clone(), 10i128).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.vault.try_pay(&k, &s.payee, &10).is_err());
    assert_eq!(s.token.balance(&s.payee), 0);
    assert!(!s.vault.paid(&k));
}

#[test]
fn pay_with_agent_auth_works() {
    let s = setup();
    let k = key(&s.env, 1);
    s.env.mock_auths(&[MockAuth {
        address: &s.agent,
        invoke: &MockAuthInvoke {
            contract: &s.vault_id,
            fn_name: "pay",
            args: (k.clone(), s.payee.clone(), 10i128).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert_eq!(s.vault.pay(&k, &s.payee, &10), 10);
    assert_eq!(s.token.balance(&s.payee), 10);
}

#[test]
fn withdraw_and_set_agent_without_auth_fail() {
    let s = setup();
    s.env.set_auths(&[]);
    assert!(s.vault.try_withdraw(&s.agent, &10).is_err());
    assert!(s.vault.try_set_agent(&s.payee).is_err());
    assert_eq!(s.token.balance(&s.agent), 0);
}
