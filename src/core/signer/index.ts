// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {Connection, JsonRpcProvider} from '@mysten/sui.js';

/**
 * This is a list of feature keys that are used in wallet
 * https://docs.growthbook.io/app/features#feature-keys
 */
export enum FEATURES {
  USE_LOCAL_TXN_SERIALIZER = 'use-local-txn-serializer',
  USE_TEST_NET_ENDPOINT = 'testnet-selection',
  STAKING_ENABLED = 'wallet-staking-enabled',
  WALLET_DAPPS = 'wallet-dapps',
  WALLET_MULTI_ACCOUNTS = 'wallet-multi-accounts',
  WALLET_LEDGER_INTEGRATION = 'wallet-ledger-integration',
}
export enum API_ENV {
  local = 'local',
  devNet = 'devNet',
  testNet = 'testNet',
  customRPC = 'customRPC',
  mainNet = 'mainNet',
}

export function getApiName(env: API_ENV) {
  if (env === API_ENV.local) return 'Local';
  if (env === API_ENV.devNet) return 'Sui Devnet';
  if (env === API_ENV.testNet) return 'Sui Testnet';
  if (env === API_ENV.mainNet) return 'Sui Mainnet';
  return 'Sui Testnet';
}

export function getApiEnvEnum(env: string) {
  if (env === 'local') return API_ENV.local;
  else if (env === 'devNet') return API_ENV.devNet;
  else if (env === 'testNet') return API_ENV.testNet;
  else if (env === 'mainNet') return API_ENV.mainNet;
  return API_ENV.testNet;
}

export enum AccountType {
  IMPORTED = 'IMPORTED',
  DERIVED = 'DERIVED',
  LEDGER = 'LEDGER',
}

export type SerializedAccount =
  | SerializedImportedAccount
  | SerializedDerivedAccount
  | SerializedLedgerAccount;

import type {SuiAddress, SignerWithProvider} from '@mysten/sui.js';
import {BackgroundServiceSigner} from './BackgroundServiceSigner';
import {
  API_ENDPOINT_DEV_NET_FAUCET,
  API_ENDPOINT_DEV_NET_FULLNODE,
  API_ENDPOINT_LOCAL_FAUCET,
  API_ENDPOINT_LOCAL_FULLNODE,
  API_ENDPOINT_MAINNET_FULLNODE,
  API_ENDPOINT_TEST_NET_FAUCET,
  API_ENDPOINT_TEST_NET_FULLNODE,
} from './const';
import {SerializedImportedAccount} from '../keyring/ImportedAccount';
import {SerializedDerivedAccount} from '../keyring/DerivedAccount';
import {SerializedLedgerAccount} from '../keyring/LedgerAccount';
import {getApiEnv} from '../local_storage/LocalStorage';

type EnvInfo = {
  name: string;
  env: API_ENV;
};

export const ENV_DEFAULT = API_ENV.mainNet;

export const API_ENV_TO_INFO: Record<API_ENV, EnvInfo> = {
  [API_ENV.local]: {name: 'Local', env: API_ENV.local},
  [API_ENV.devNet]: {name: 'Sui Devnet', env: API_ENV.devNet},
  [API_ENV.customRPC]: {name: 'Custom RPC URL', env: API_ENV.customRPC},
  [API_ENV.testNet]: {name: 'Sui Testnet', env: API_ENV.testNet},
  [API_ENV.mainNet]: {name: 'Sui Mainnet', env: API_ENV.mainNet},
};

export const ENV_TO_API: Record<API_ENV, Connection | null> = {
  [API_ENV.local]: new Connection({
    fullnode: API_ENDPOINT_LOCAL_FULLNODE || '',
    faucet: API_ENDPOINT_LOCAL_FAUCET || '',
  }),
  [API_ENV.devNet]: new Connection({
    fullnode: API_ENDPOINT_DEV_NET_FULLNODE || '',
    faucet: API_ENDPOINT_DEV_NET_FAUCET || '',
  }),
  [API_ENV.customRPC]: null,
  [API_ENV.testNet]: new Connection({
    fullnode: API_ENDPOINT_TEST_NET_FULLNODE || '',
    faucet: API_ENDPOINT_TEST_NET_FAUCET || '',
  }),
  [API_ENV.mainNet]: new Connection({
    fullnode: API_ENDPOINT_MAINNET_FULLNODE || '',
    faucet: '',
  }),
};

export function getDefaultApiEnv() {
  const apiEnv = 'mainNet';
  if (apiEnv && !Object.keys(API_ENV).includes(apiEnv)) {
    throw new Error(`Unknown environment variable API_ENV, ${apiEnv}`);
  }
  return apiEnv ? API_ENV[apiEnv as keyof typeof API_ENV] : ENV_DEFAULT;
}

function getDefaultAPI(env: API_ENV) {
  const apiEndpoint = ENV_TO_API[env];
  if (!apiEndpoint || apiEndpoint.fullnode === '') {
    throw new Error(`API endpoint not found for API_ENV ${env}`);
  }
  return apiEndpoint;
}

export const DEFAULT_API_ENV = getDefaultApiEnv();

type NetworkTypes = keyof typeof API_ENV;

export const generateActiveNetworkList = (): NetworkTypes[] => {
  const excludedNetworks: NetworkTypes[] = [];
  return Object.values(API_ENV).filter(
    env => !excludedNetworks.includes(env as keyof typeof API_ENV),
  );
};

export default class ApiProvider {
  private _apiFullNodeProvider?: JsonRpcProvider;
  private _signerByAddress: Map<SuiAddress, SignerWithProvider> = new Map();

  public setNewJsonRpcProvider(
    apiEnv: API_ENV = DEFAULT_API_ENV,
    customRPC?: string | null,
  ) {
    try {
      const connection = customRPC
        ? new Connection({fullnode: customRPC})
        : getDefaultAPI(apiEnv);
      this._apiFullNodeProvider = new JsonRpcProvider(connection, {
        rpcClient: undefined,
      });
      this._signerByAddress.clear();
    } catch (e) {
      console.log(e);
    }
  }

  public async instance() {
    const env = await getApiEnv();
    if (env) {
      if (!this._apiFullNodeProvider) {
        this.setNewJsonRpcProvider(getApiEnvEnum(env));
      }
    } else {
      if (!this._apiFullNodeProvider) {
        this.setNewJsonRpcProvider();
      }
    }
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fullNode: this._apiFullNodeProvider!,
    };
  }

  public async getSignerInstance(
    account: SerializedAccount,
  ): Promise<SignerWithProvider> {
    const env = await getApiEnv();
    if (!this._apiFullNodeProvider) {
      this.setNewJsonRpcProvider(getApiEnvEnum(env!));
    }
    // console.log(account, 'account--------------------------')

    switch (account.type) {
      case AccountType.DERIVED:
      case AccountType.IMPORTED:
        return this.getSignerInstanceImported(account.address);
      case AccountType.LEDGER:
        // Ideally, Ledger transactions would be signed in the background
        // and exist as an asynchronous keypair; however, this isn't possible
        // because you can't connect to a Ledger device from the background
        // script. Similarly, the signer instance can't be retrieved from
        // here because ApiProvider is a global and results in very buggy
        // behavior due to the reactive nature of managing Ledger connections
        // and displaying relevant UI updates. Refactoring ApiProvider to
        // not be a global instance would help out here, but that is also
        // a non-trivial task because we need access to ApiProvider in the
        // background script as well.
        throw new Error("Signing with Ledger via ApiProvider isn't supported");
      default:
        throw new Error('Encountered unknown account type');
    }
  }

  public getSignerInstanceImported(address: SuiAddress): SignerWithProvider {
    if (!this._signerByAddress.has(address)) {
      this._signerByAddress.set(
        address,
        new BackgroundServiceSigner(address, this._apiFullNodeProvider!),
      );
    }
    return this._signerByAddress.get(address)!;
  }
}
