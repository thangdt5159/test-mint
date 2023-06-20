// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
  type SerializedSignature,
  SignerWithProvider,
  fromExportedKeypair,
} from '@mysten/sui.js';

import type {JsonRpcProvider, SuiAddress} from '@mysten/sui.js';
import keyring from '../keyring';
import {AccountKeypair} from '../keyring/AccountKeypair';

export class BackgroundServiceSigner extends SignerWithProvider {
  readonly #address: SuiAddress;
  // private keyring: Keyring = new Keyring();

  constructor(address: SuiAddress, provider: JsonRpcProvider) {
    super(provider);
    this.#address = address;
  }

  async getAddress(): Promise<string> {
    return this.#address;
  }

  async signData(data: Uint8Array): Promise<SerializedSignature> {
    const account = await keyring.getActiveAccount();
    const accountSign = new AccountKeypair(
      fromExportedKeypair(account.accountKeypair.exportKeypair()),
    );
    const signature = await accountSign.sign(data);
    return signature;
  }

  connect(provider: JsonRpcProvider): SignerWithProvider {
    return new BackgroundServiceSigner(this.#address, provider);
  }
}
