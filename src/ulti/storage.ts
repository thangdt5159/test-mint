import EncryptedStorage from 'react-native-encrypted-storage';

export async function getFromStorage<T>(key: string) {
  try {
    const data = await EncryptedStorage.getItem(key);
    if (data !== undefined && data !== null) {
      return JSON.parse(data || '');
    }
  } catch (error) {
    throw new Error(`Cannot access encrypted memory! ${error as string}`);
  }
}

export async function setToStorage<T>(key: string, value: T): Promise<void> {
  try {
    await EncryptedStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    throw new Error(`Cannot save encrypted memory! ${error as string}`);
  }
}
