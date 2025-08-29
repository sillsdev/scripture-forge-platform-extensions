import { isString } from 'platform-bible-utils';
import { ServerConfiguration, ServerConfigurationPresetNames } from 'scripture-forge';

/**
 * Names of the presets for server configuration settings - lets the user connect to different sets
 * of servers easily
 */
export const SERVER_CONFIGURATION_PRESET_NAMES: ServerConfigurationPresetNames[] = [
  'dev',
  'qa',
  'live',
];

/** Sets of configuration for which servers to use */
const SERVER_CONFIGURATIONS: {
  [configuration in ServerConfigurationPresetNames]: ServerConfiguration;
} = {
  dev: {
    scriptureForge: {
      domain: 'localhost',
      webSocket: 'ws://localhost',
    },
    auth: {
      domain: 'https://sil-appbuilder.auth0.com',
      clientId: 'aoAGb9Yx1H5WIsvCW6JJCteJhSa37ftH',
    },
  },
  qa: {
    scriptureForge: {
      domain: 'https://qa.scriptureforge.org',
      webSocket: 'wss://qa.scriptureforge.org/realtime-api',
    },
    auth: {
      domain: 'https://dev-sillsdev.auth0.com',
      clientId: '4eHLjo40mAEGFU6zUxdYjnpnC1K1Ydnj',
      // This clientId was setup within Auth0 as a separate application with more redirect URL options
      // However, it was not setup in https://github.com/sillsdev/auth0-configs, so it will disappear the next time a config is pushed
      // clientId: 'keZORmin26og8b8cNvcdLTTu9GRUu5VA',
    },
  },
  live: {
    scriptureForge: {
      domain: 'https://scriptureforge.org',
      webSocket: 'wss://scriptureforge.org/ws',
    },
    auth: {
      domain: 'https://login.languagetechnology.org',
      clientId: 'tY2wXn40fsL5VsPM4uIHNtU6ZUEXGeFn',
    },
  },
};

export function expandServerConfiguration(
  configuration: ServerConfigurationPresetNames | ServerConfiguration,
): ServerConfiguration {
  return isString(configuration) ? SERVER_CONFIGURATIONS[configuration] : configuration;
}
