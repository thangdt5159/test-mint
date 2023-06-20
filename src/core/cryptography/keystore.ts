// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
  encrypt as metamaskEncrypt,
  decrypt as metamaskDecrypt,
} from '../cryptography/passworder';

type Serializable =
  | string
  | number
  | boolean
  | {[index: string]: Serializable}
  | Serializable[];

export async function encryptPassword(
  password: string,
  secrets: Serializable,
): Promise<string> {
  return metamaskEncrypt(password, secrets);
}
export async function decryptPassword<T extends Serializable>(
  password: string,
  ciphertext: string,
): Promise<T> {
  return (await metamaskDecrypt(password, ciphertext)) as T;
}
