import { isString, Mutex } from 'platform-bible-utils';

export type EncryptionService = {
  encrypt(data: string): Promise<string>;
  decrypt(data: string): Promise<string>;
};

export type StorageService = {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
  delete(key: string): Promise<void>;
};

/**
 * Class that manages reading and writing sensitive data to a store. Uses a single mutex to make
 * sure all reading and writing to any keys happen serially
 */
export default class SecureStorageManager {
  private mutex = new Mutex();
  constructor(
    private encryption: EncryptionService,
    private storage: StorageService,
  ) {}

  async get(key: string): Promise<string | undefined> {
    return this.mutex.runExclusive(async () => {
      const encryptedData = await this.storage.get(key);
      return isString(encryptedData) ? this.encryption.decrypt(encryptedData) : encryptedData;
    });
  }

  async set(key: string, value: string): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const encryptedValue = await this.encryption.encrypt(value);
      return this.storage.set(key, encryptedValue);
    });
  }

  async delete(key: string): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return this.storage.delete(key);
    });
  }
}
