import {Buffer} from 'buffer';
declare global {
  var crypto: any;
}
/**
 * Encrypts a data object that can be any serializable value using
 * a provided password.
 *
 * @param {string} password - password to use for encryption
 * @param {R} dataObj - data to encrypt
 * @returns {Promise<string>} cypher text
 */
export function encrypt(password: any, dataObj: any) {
  const salt = generateSalt();
  return keyFromPassword(password, salt)
    .then(function (passwordDerivedKey: any) {
      return encryptWithKey(passwordDerivedKey, dataObj);
    })
    .then(function (payload: {salt: string}) {
      payload.salt = salt;
      return JSON.stringify(payload);
    });
}
/**
 * Encrypts the provided serializable javascript object using the
 * provided CryptoKey and returns an object containing the cypher text and
 * the initialization vector used.
 * @param {CryptoKey} key - CryptoKey to encrypt with
 * @param {R} dataObj - Serializable javascript object to encrypt
 * @returns {EncryptionResult}
 */
export function encryptWithKey(key: any, dataObj: any) {
  const data = JSON.stringify(dataObj);
  const dataBuffer = Buffer.from(data, 'utf-8');
  const vector = global.crypto.getRandomValues(new Uint8Array(16));
  return global.crypto.subtle
    .encrypt(
      {
        name: 'AES-GCM',
        iv: vector,
      },
      key,
      dataBuffer,
    )
    .then(function (buf: Iterable<number>) {
      const buffer = new Uint8Array(buf);
      const vectorStr = Buffer.from(vector).toString('base64');
      const vaultStr = Buffer.from(buffer).toString('base64');
      return {
        data: vaultStr,
        iv: vectorStr,
      };
    });
}
/**
 * Given a password and a cypher text, decrypts the text and returns
 * the resulting value
 * @param {string} password - password to decrypt with
 * @param {string} text - cypher text to decrypt
 */
export function decrypt(password: any, text: string) {
  const payload = JSON.parse(text);
  const {salt} = payload;
  return keyFromPassword(password, salt).then(function (key: any) {
    return decryptWithKey(key, payload);
  });
}
/**
 * Given a CryptoKey and an EncryptionResult object containing the initialization
 * vector (iv) and data to decrypt, return the resulting decrypted value.
 * @param {CryptoKey} key - CryptoKey to decrypt with
 * @param {EncryptionResult} payload - payload returned from an encryption method
 */
export function decryptWithKey(
  key: any,
  payload: {
    data:
      | WithImplicitCoercion<string>
      | {[Symbol.toPrimitive](hint: 'string'): string};
    iv:
      | WithImplicitCoercion<string>
      | {[Symbol.toPrimitive](hint: 'string'): string};
  },
) {
  const encryptedData = Buffer.from(payload.data, 'base64');
  const vector = Buffer.from(payload.iv, 'base64');
  return global.crypto.subtle
    .decrypt({name: 'AES-GCM', iv: vector}, key, encryptedData)
    .then(function (result: Iterable<number>) {
      const decryptedData = new Uint8Array(result);
      const decryptedStr = Buffer.from(decryptedData).toString('utf-8');
      const decryptedObj = JSON.parse(decryptedStr);
      return decryptedObj;
    })
    .catch(function (_error: any) {
      throw new Error('Incorrect password');
    });
}
/**
 * Generate a CryptoKey from a password and random salt
 * @param {string} password - The password to use to generate key
 * @param {string} salt - The salt string to use in key derivation
 */
export function keyFromPassword(
  password:
    | WithImplicitCoercion<string>
    | {[Symbol.toPrimitive](hint: 'string'): string},
  salt:
    | WithImplicitCoercion<string>
    | {[Symbol.toPrimitive](hint: 'string'): string},
) {
  const passBuffer = Buffer.from(password, 'utf-8');
  const saltBuffer = Buffer.from(salt, 'base64');
  return global.crypto.subtle
    .importKey('raw', passBuffer, {name: 'PBKDF2'}, false, [
      'deriveBits',
      'deriveKey',
    ])
    .then(function (key: any) {
      return global.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 10000,
          hash: 'SHA-256',
        },
        key,
        {name: 'AES-GCM', length: 256},
        true,
        ['encrypt', 'decrypt'],
      );
    });
}
/**
 * Converts a hex string into a buffer.
 * @param {string} str - hex encoded string
 * @returns {Uint8Array}
 */
export function serializeBufferFromStorage(str: string) {
  const stripStr = str.slice(0, 2) === '0x' ? str.slice(2) : str;
  const buf = new Uint8Array(stripStr.length / 2);
  for (let i = 0; i < stripStr.length; i += 2) {
    const seg = stripStr.substr(i, 2);
    buf[i / 2] = parseInt(seg, 16);
  }
  return buf;
}
/**
 * Converts a buffer into a hex string ready for storage
 * @param {Uint8Array} buffer - Buffer to serialize
 * @returns {string} hex encoded string
 */
export function serializeBufferForStorage(buffer: Buffer) {
  let result = '0x';
  const len = buffer.length || buffer.byteLength;
  for (let i = 0; i < len; i++) {
    result += unprefixedHex(buffer[i]);
  }
  return result;
}
/**
 * Converts a number into hex value, and ensures proper leading 0
 * for single characters strings.
 * @param {number} num - number to convert to string
 * @returns {string} hex string
 */
export function unprefixedHex(num: {toString: (arg0: number) => any}) {
  let hex = num.toString(16);
  while (hex.length < 2) {
    hex = `0${hex}`;
  }
  return hex;
}
/**
 * Generates a random string for use as a salt in CryptoKey generation
 * @param {number} byteCount - Number of bytes to generate
 * @returns {string} randomly generated string
 */
export function generateSalt(byteCount = 32) {
  const view = new Uint8Array(byteCount);
  global.crypto.getRandomValues(view);
  // Uint8Array is a fixed length array and thus does not have methods like pop, etc
  // so TypeScript complains about casting it to an array. Array.from() works here for
  // getting the proper type, but it results in a functional difference. In order to
  // cast, you have to first cast view to unknown then cast the unknown value to number[]
  // TypeScript ftw: double opt in to write potentially type-mismatched code.
  const b64encoded = btoa(String.fromCharCode.apply(null, view as any));
  return b64encoded;
}
