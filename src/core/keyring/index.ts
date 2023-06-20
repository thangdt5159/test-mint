// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {Ed25519Keypair, ExportedKeypair, SuiAddress} from '@mysten/sui.js';
import type {Keypair} from '@mysten/sui.js';

import {LedgerAccount, SerializedLedgerAccount} from './LedgerAccount';
import {Account, isImportedOrDerivedAccount} from './Account';
import {ImportedAccount} from './ImportedAccount';
import {DerivedAccount} from './DerivedAccount';
import {VaultStorage} from './VaultStorage';
import ApiProvider, {ENV_DEFAULT} from '../signer';
import {getFromStorage, setToStorage} from '../../ulti/storage';
import {getApiEnv, savePassword} from '../local_storage/LocalStorage';

/** The key for the extension's storage, that holds the index of the last derived account (zero based) */
const STORAGE_LAST_ACCOUNT_INDEX_KEY = 'last_account_index';
const STORAGE_ACTIVE_ACCOUNT = 'active_account';

export const STORAGE_IMPORTED_LEDGER_ACCOUNTS = 'imported_ledger_accounts';

export class Keyring {
  #locked = true;
  #mainDerivedAccount: SuiAddress | null = null;
  #accountsMap: Map<SuiAddress, Account> = new Map();
  public readonly reviveDone: Promise<void>;

  constructor() {
    this.reviveDone = this.revive().catch(e => {
      // if for some reason decrypting the vault fails or anything else catch
      // the error to allow the user to login using the password
    });
  }

  /**
   * Creates a vault and stores it encrypted to the storage of the extension. It doesn't unlock the vault.
   * @param password The password to encrypt the vault
   * @param importedEntropy The entropy that was generated from an existing mnemonic that the user provided
   * @throws If the wallet exists or any other error during encrypting/saving to storage or if importedEntropy is invalid
   */
  public async createVault(password: string, importedEntropy?: string) {
    await VaultStorage.create(password, importedEntropy);
  }

  public async lock() {
    this.#accountsMap.clear();
    this.#mainDerivedAccount = null;
    this.#locked = true;
    await VaultStorage.lock();
  }

  public async unlock(
    password: string,
    setAuth: boolean = true,
    updateStatus = true,
  ) {
    await VaultStorage.unlock(password);
    if (setAuth == true && updateStatus) {
    }

    savePassword(password);

    await this.unlocked();
  }

  public async clearVault() {
    this.lock();
    await setToStorage(STORAGE_LAST_ACCOUNT_INDEX_KEY, 0);
    await VaultStorage.clear();
  }

  public async isWalletInitialized() {
    return await VaultStorage.isWalletInitialized();
  }

  public get isLocked() {
    return this.#locked;
  }

  public async getActiveAccount(index: number) {
    const address = await getFromStorage(STORAGE_ACTIVE_ACCOUNT);
    const account = this.deriveAccount(
      index,
      'analyst device spy quit aisle clay outside ghost lizard cause lecture rubber',
    );

    return (
      (address && this.#accountsMap.get(address)) ||
      (this.#mainDerivedAccount &&
        this.#accountsMap.get(this.#mainDerivedAccount)) ||
      account ||
      null
    );
  }

  public async deriveNextAccount() {
    const mnemonic = VaultStorage.getMnemonic();
    if (!mnemonic) {
      return null;
    }
    const nextIndex = (await this.getLastDerivedIndex()) + 1;
    await this.storeLastDerivedIndex(nextIndex);
    const account = this.deriveAccount(nextIndex, mnemonic);
    this.#accountsMap.set(account.address, account);
    return account;
  }

  public async importLedgerAccounts(ledgerAccounts: SerializedLedgerAccount[]) {
    if (this.isLocked) {
      return null;
    }

    await this.storeLedgerAccounts(ledgerAccounts);

    for (const ledgerAccount of ledgerAccounts) {
      const account = new LedgerAccount({
        derivationPath: ledgerAccount.derivationPath,
        address: ledgerAccount.address,
      });
      this.#accountsMap.set(ledgerAccount.address, account);
    }
  }

  public getAccounts() {
    if (this.isLocked) {
      return null;
    }
    return Array.from(this.#accountsMap.values());
  }

  public async changeActiveAccount(address: SuiAddress) {
    await this.storeActiveAccount(address);
    return true;
  }

  /**
   * Exports the keypair for the specified address. Verifies that the password provided is the correct one and only then returns the keypair.
   * This is useful to be used for exporting the to the UI for the user to backup etc. Getting accounts and keypairs is possible without using
   * a password by using {@link Keypair.getAccounts} or {@link Keypair.getActiveAccount} or the change events
   * @param address The sui address to export the keypair
   * @param password The current password of the vault
   * @returns null if locked or address not found or the exported keypair
   * @throws if wrong password is provided
   */
  public async exportAccountKeypair(address: SuiAddress, password: string) {
    if (this.isLocked) {
      return null;
    }
    if (await VaultStorage.verifyPassword(password)) {
      const account = this.#accountsMap.get(address);
      if (!account || !isImportedOrDerivedAccount(account)) {
        return null;
      }
      return account.accountKeypair.exportKeypair();
    } else {
      throw new Error('Wrong password');
    }
  }

  public async importAccountKeypair(
    keypair: ExportedKeypair,
    password: string,
  ) {
    const currentAccounts = this.getAccounts();
    if (this.isLocked || !currentAccounts) {
      // this function is expected to be called from UI when unlocked
      // so this shouldn't happen
      throw new Error('Wallet is locked');
    }
    const passwordCorrect = await VaultStorage.verifyPassword(password);
    if (!passwordCorrect) {
      // we need to make sure that the password is the same with the one of the current vault because we will
      // update the vault and encrypt it to persist the new keypair in storage
      throw new Error('Wrong password');
    }

    const importedOrDerivedAccounts = currentAccounts.filter(
      isImportedOrDerivedAccount,
    );
    const added = await VaultStorage.importKeypair(
      keypair,
      password,
      importedOrDerivedAccounts,
    );
    if (added) {
      const importedAccount = new ImportedAccount({
        keypair: added,
      });
      this.#accountsMap.set(importedAccount.address, importedAccount);
    }
    return added;
  }

  private async revive() {
    const unlocked = await VaultStorage.revive();
    console.log(this.revive, 'revive');
    if (unlocked) {
      await this.unlocked();
    }
  }

  private async unlocked() {
    let mnemonic = VaultStorage.getMnemonic();
    if (!mnemonic) {
      return;
    }
    const lastAccountIndex = await this.getLastDerivedIndex();
    for (let i = 0; i <= lastAccountIndex; i++) {
      const account = this.deriveAccount(i, mnemonic);
      this.#accountsMap.set(account.address, account);
      if (i === 0) {
        this.#mainDerivedAccount = account.address;
      }
    }

    const savedLedgerAccounts = await this.getSavedLedgerAccounts();
    for (const savedLedgerAccount of savedLedgerAccounts) {
      this.#accountsMap.set(
        savedLedgerAccount.address,
        new LedgerAccount({
          derivationPath: savedLedgerAccount.derivationPath,
          address: savedLedgerAccount.address,
        }),
      );
    }

    VaultStorage.getImportedKeys()?.forEach(anImportedKey => {
      const account = new ImportedAccount({
        keypair: anImportedKey,
      });
      // there is a case where we can import a private key of an account that can be derived from the mnemonic but not yet derived
      // if later we derive it skip overriding the derived account with the imported one (convert the imported as derived in a way)
      if (!this.#accountsMap.has(account.address)) {
        this.#accountsMap.set(account.address, account);
      }
    });
    // const apiProvider = new ApiProvider();
    // const account = await this.getActiveAccount();
    // const signer = await apiProvider.getSignerInstance(account);
    var currentNetwork = await getApiEnv();
    currentNetwork = currentNetwork ?? ENV_DEFAULT;
    mnemonic = null;
    this.#locked = false;
  }

  private deriveAccount(accountIndex: number, mnemonic: string) {
    const derivationPath = this.makeDerivationPath(accountIndex);
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic, derivationPath);
    return new DerivedAccount({keypair, derivationPath});
  }

  private async getLastDerivedIndex() {
    return (await getFromStorage(STORAGE_LAST_ACCOUNT_INDEX_KEY)) || 0;
  }

  private storeLastDerivedIndex(index: number) {
    return setToStorage(STORAGE_LAST_ACCOUNT_INDEX_KEY, index);
  }

  private storeActiveAccount(address: SuiAddress) {
    return setToStorage(STORAGE_ACTIVE_ACCOUNT, address);
  }

  private async getSavedLedgerAccounts() {
    const ledgerAccounts = await getFromStorage<SerializedLedgerAccount[]>(
      STORAGE_IMPORTED_LEDGER_ACCOUNTS,
    );
    return ledgerAccounts || [];
  }

  private storeLedgerAccounts(ledgerAccounts: SerializedLedgerAccount[]) {
    return setToStorage(STORAGE_IMPORTED_LEDGER_ACCOUNTS, ledgerAccounts);
  }

  private makeDerivationPath(index: number) {
    // currently returns only Ed25519 path
    return `m/44'/784'/${index}'/0'/0'`;
  }
}

export default new Keyring();
