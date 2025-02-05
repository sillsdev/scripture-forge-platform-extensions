import { logger } from '@papi/backend';

export async function activate() {
  logger.info('Scripture Forge Extension is activating!');
}

export async function deactivate() {
  logger.info('Scripture Forge Extension is deactivating!');
  return true;
}
