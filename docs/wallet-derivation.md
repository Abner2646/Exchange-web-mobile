# HD Wallet Derivation — FROZEN reference

> ## ⚠️ FROZEN — do NOT change any value in this document
>
> These derivation parameters (paths, coin types, BIP standards, address formats,
> xpub-prefix → path mapping, extended-key version bytes) **work today and are tied
> to real wallets recreated in external apps**. Changing any of them changes which
> keys/addresses the custodian controls — i.e. it silently orphans funds and forces
> a guess-and-recover of these exact values from an external wallet. **This is a
> deliberate product decision (2026-09-04): the derivation is not to be "fixed" or
> "cleaned up" — only documented.** Surrounding dead code / tech debt may be cleaned
> *only if it does not alter any value below*. When in doubt: don't touch, document.
>
> Feeds the compliance mapping §4.2 (custodial key management). See `ROADMAP.md`
> Fase 3.1b (the BIP84-vs-BIP44 "inconsistency" is **not** a bug to fix — see below).

## Bitcoin (the authoritative flow is driven by the xpub prefix)

The master wallet's stored `derivationPath` is chosen from the **prefix of
`BTC_MASTER_XPUB`** (`models/direccionDeposito.model.js:_createMasterWalletFromEnv`,
~line 505–564). Deposit addresses are then derived from that stored path. This is
internally consistent — the prefix, path, and address format always agree.

| `BTC_MASTER_XPUB` prefix | BIP standard | Derivation path | Address format | Address example | Ext-key version bytes (pub/priv) |
|---|---|---|---|---|---|
| `vpub` / `vprv` **← current setup ("TU CASO")** | BIP84 native segwit | `m/84'/1'/0'` | p2wpkh | `tb1…` | `0x045f1cf6` / `0x045f18bc` |
| `upub` / `uprv` | BIP49 P2SH-segwit | `m/49'/1'/0'` | p2sh(p2wpkh) | `2…` | `0x044a5262` / `0x044a4e28` |
| `tpub` / `tprv` | BIP44 legacy | `m/44'/1'/0'` | p2pkh | `m…` / `n…` | `0x043587cf` / `0x04358394` |
| unknown / unset | fallback | `BTC_DERIVATION_PATH` env, else `m/84'/1'/0'` | — | — | — |

- **Per-user deposit address** = `` `${walletMaestra.derivationPath}/0/${index}` `` (`direccionDeposito.model.js:393`), e.g. `m/84'/1'/0'/0/0`, `…/0/1`, … The address encoding uses a network object built from the same xpub prefix (`direccionDeposito.model.js:_generateBitcoinAddress`, ~line 623–685); payment type per format: native-segwit → `p2wpkh` (`tb1`), P2SH-segwit → `p2sh` (`2`), legacy → `p2pkh` (`m`/`n`) (~line 740–790).
- **Master wallet's own address** (for withdrawals) = `p2wpkh` from `BTC_PRIVATE_KEY` (`services/blockchain/bitcoin.service.js:initializeMasterWallet`, ~line 38–45).
- **`WalletSetupGenerator.getBTCWalletFromEnv`** (`controllers/setupWallets.controller.js:~228–262`) is a **separate** routine that derives `fingerprint`/`publicKey` **from `BTC_MNEMONIC`** using `m/44'/1'/0'` (testnet) or `m/44'/0'/0'` (mainnet). This is why the seed catalog (below) declaring `m/84'` and this routine using `m/44'` look inconsistent — see "Known quirks".

## Ethereum

- Source: `ETH_MASTER_SEED`; path = `ETH_DERIVATION_PATH` env, else **`m/44'/60'/0'`** (`direccionDeposito.model.js:535–539`).
- EVM addresses are **network-agnostic** (the same key gives the same address on any EVM chain), so there is no testnet/mainnet address-space split here — only chainId/RPC differ (see `config/networks/evm.js`).
- Master wallet address / signing from `ETH_PRIVATE_KEY` (mainnet) / `ETH_SEPOLIA_PRIVATE_KEY` (testnet).

## BSC

- Source: `BSC_MASTER_SEED`; path = `BSC_DERIVATION_PATH` env, else **`m/44'/60'/0'`** (`direccionDeposito.model.js:541–545`).
- Same EVM key/address model as Ethereum; signing from `BNB_PRIVATE_KEY` / `BNB_TESTNET_PRIVATE_KEY`.

## Seed catalog defaults (metadata only — not the live derivation)

`CRIPTOMONEDAS_BASICAS` (`controllers/setupWallets.controller.js:14–40`) declares
default `derivationPath`s used when seeding the `Criptomoneda` catalog:

| Symbol | Declared path |
|---|---|
| BTC | `m/84'/1'/0'` |
| ETH | `m/44'/60'/0'` |
| BNB | `m/44'/60'/0'` |

These are catalog defaults. The **live** master-wallet path comes from the xpub
prefix (BTC) / env (ETH, BSC) as documented above — not from this table.

## Env vars that control derivation (do not repurpose)

`BTC_MASTER_XPUB`, `BTC_PRIVATE_KEY`, `BTC_MNEMONIC`, `BTC_DERIVATION_PATH`,
`BITCOIN_WALLET_ADDRESS`; `ETH_MASTER_SEED`, `ETH_DERIVATION_PATH`,
`ETH_PRIVATE_KEY`, `ETH_SEPOLIA_PRIVATE_KEY`; `BSC_MASTER_SEED`,
`BSC_DERIVATION_PATH`, `BNB_PRIVATE_KEY`, `BNB_TESTNET_PRIVATE_KEY`.

## Known quirks — documented on purpose, NOT to be "fixed"

1. **Seed catalog says BIP84 (`m/84'`), `getBTCWalletFromEnv` derives BIP44 (`m/44'`).**
   Not a real defect for live usage: deposit addresses and the master wallet path are
   driven by the **xpub prefix**, which is self-consistent. `getBTCWalletFromEnv`'s
   `fingerprint`/`publicKey` are a separate concern. (`btcDerivationPath.test.js` pins
   that the persisted metadata honestly reflects the path actually used — Altos #8.)
   **Frozen.**
2. **`_generateBitcoinAddress` hardcodes `bitcoin.networks.testnet` in the
   `bitcoin.payments.*` encoding** (`direccionDeposito.model.js:~745–769`), so deposit
   addresses are always encoded for **testnet**. Correct for the current testnet setup;
   it would need revisiting for a real mainnet migration (itself a gated, Abner-present
   task). **Not fixed now** — the address encoding is exactly what the external wallet
   depends on. Recorded here as a mainnet-migration prerequisite, not a current bug.

> Reminder: this file is the source of truth for "what must never change." If a
> refactor would alter any path, version byte, format, or the xpub-prefix mapping,
> stop — that is out of bounds by the 2026-09-04 decision.
