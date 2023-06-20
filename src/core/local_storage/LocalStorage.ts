import EncryptedStorage from 'react-native-encrypted-storage';
import {API_ENV} from '../signer';

export const PREF_SEED_PHRASE = 'PREF_SEED_PHRASE';
export const PREF_PASSWORD = 'PREF_PASSWORD';
export const PREF_OLD_ADDRESS = 'PREF_OLD_ADDRESS';
export const PREF_API_ENV = 'PREF_API_ENV';
export const PREF_ACCOUNT_ADDRESS = 'PREF_ACCOUNT_ADDRESS';

export function saveSeedPhrase(seedPhrase: string) {
  return EncryptedStorage.setItem(PREF_SEED_PHRASE, seedPhrase);
}

export async function getSeedPhrase() {
  return await EncryptedStorage.getItem(PREF_SEED_PHRASE);
}

export function savePassword(password: string) {
  return EncryptedStorage.setItem(PREF_PASSWORD, password);
}

export async function getPassword() {
  return await EncryptedStorage.getItem(PREF_PASSWORD);
}

export function saveOldAddress(OldAddress: string) {
  return EncryptedStorage.setItem(PREF_OLD_ADDRESS, OldAddress);
}

export async function getOldAddress() {
  return await EncryptedStorage.getItem(PREF_OLD_ADDRESS);
}

export function saveApiEnv(apiEnv: API_ENV) {
  return EncryptedStorage.setItem(PREF_API_ENV, apiEnv);
}

export async function getApiEnv() {
  return await EncryptedStorage.getItem(PREF_API_ENV);
}

export function saveAccountAddress(address: string) {
  return EncryptedStorage.setItem(PREF_ACCOUNT_ADDRESS, address);
}

export async function getAccountAddress() {
  return await EncryptedStorage.getItem(PREF_ACCOUNT_ADDRESS);
}
