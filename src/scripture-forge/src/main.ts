import papi, { logger } from '@papi/backend';
import { ExecutionActivationContext, IWebViewProvider } from '@papi/core';
import { isString } from 'platform-bible-utils';
import ScriptureForgeAuthenticationProvider, {
  AUTH_PATH,
} from './auth/scripture-forge-authentication-provider.model';
import SecureStorageManager from './auth/secure-storage-manager.model';
import homeWebView from './home/home.web-view?inline';
import tailwindStyles from './tailwind.css?inline';
import { SERVER_CONFIGURATION_PRESET_NAMES } from './auth/server-configuration.model';
import ScriptureForgeAPI from './projects/scripture-forge-api.model';
import SlingshotProjectDataProviderEngineFactory from './projects/slingshot-project-data-provider-engine-factory.model';
import { SLINGSHOT_PROJECT_INTERFACES } from './projects/slingshot-project-data-provider-engine.model';

type IWebViewProviderWithType = IWebViewProvider & { webViewType: string };

const HAS_COMPLETED_FIRST_STARTUP_KEY = 'hasCompletedFirstStartup';
const SCRIPTURE_FORGE_HOME_WEB_VIEW_TYPE = 'scriptureForge.home';

/** Simple web view provider that provides Scripture Forge Home web views when papi requests them */
const homeWebViewProvider: IWebViewProviderWithType = {
  webViewType: 'scriptureForge.home',
  async getWebView(savedWebView) {
    if (savedWebView.webViewType !== this.webViewType)
      throw new Error(
        `${this.webViewType} provider received request to provide a ${savedWebView.webViewType} web view`,
      );
    return {
      iconUrl: 'papi-extension://scriptureForge/assets/images/sf.svg',
      title: 'Scripture Forge',
      ...savedWebView,
      content: homeWebView,
      styles: tailwindStyles,
    };
  },
};

export async function activate(context: ExecutionActivationContext) {
  logger.info('Scripture Forge Extension is activating!');

  const homeWebViewProviderPromise = papi.webViewProviders.registerWebViewProvider(
    homeWebViewProvider.webViewType,
    homeWebViewProvider,
  );

  // #region Validate settings

  const serverConfigurationValidatorPromise = papi.settings.registerValidator(
    'scriptureForge.serverConfiguration',
    // TODO: Localize these error messages. Do we do this in other validators?
    async (newConfig) => {
      if (isString(newConfig)) {
        if (!SERVER_CONFIGURATION_PRESET_NAMES.includes(newConfig))
          throw new Error(
            `Server configuration preset name must be one of ${SERVER_CONFIGURATION_PRESET_NAMES.join(', ')}`,
          );
        return true;
      }

      if (
        typeof newConfig !== 'object' ||
        typeof newConfig.scriptureForge !== 'object' ||
        !isString(newConfig.scriptureForge.domain) ||
        typeof newConfig.auth !== 'object' ||
        !isString(newConfig.auth.clientId) ||
        !isString(newConfig.auth.domain !== 'string')
      )
        throw new Error(
          'Custom configuration must follow the `ServerConfiguration` type in the `scripture-forge` extension',
        );
      return true;
    },
  );
  const showSlingshotDisclaimerValidatorPromise = papi.settings.registerValidator(
    'scriptureForge.shouldShowSlingshotDisclaimer',
    async (newShowDisclaimer) => typeof newShowDisclaimer === 'boolean',
  );

  // #endregion

  // #region Set up authentication provider for logging into Scripture Forge

  const serverConfiguration = await papi.settings.get('scriptureForge.serverConfiguration');

  const isEncryptionAvailable = await papi.dataProtection.isEncryptionAvailable();
  if (!isEncryptionAvailable)
    logger.info('Scripture Forge is unable to use encryption. Will not save login tokens.');
  const authStorageManager = isEncryptionAvailable
    ? new SecureStorageManager(
        { encrypt: papi.dataProtection.encryptString, decrypt: papi.dataProtection.decryptString },
        {
          async set(key, value) {
            return papi.storage.writeUserData(context.executionToken, key, value);
          },
          async get(key) {
            try {
              return await papi.storage.readUserData(context.executionToken, key);
            } catch (e) {
              logger.debug(
                `Scripture Forge storage manager did not find user data for key: ${key}`,
              );
              return undefined;
            }
          },
          async delete(key) {
            return papi.storage.deleteUserData(context.executionToken, key);
          },
        },
      )
    : undefined;

  const sessionChangeEmitter = papi.network.createNetworkEventEmitter<undefined>(
    'scriptureForge.sessionChange',
  );

  const authenticationProvider = new ScriptureForgeAuthenticationProvider(
    context.elevatedPrivileges.handleUri
      ? `${context.elevatedPrivileges.handleUri.redirectUri}${AUTH_PATH}`
      : undefined,
    (url) => papi.commands.sendCommand('platform.openWindow', url),
    serverConfiguration,
    authStorageManager,
    sessionChangeEmitter.emit,
  );

  context.registrations.add(sessionChangeEmitter, authenticationProvider);

  if (!context.elevatedPrivileges.handleUri) {
    logger.warn(
      'Scripture Forge could not get handleUri. Will not be able to log into Scripture Forge.',
    );
  } else {
    context.registrations.add(
      context.elevatedPrivileges.handleUri.registerUriHandler(async (uri) => {
        const url = new URL(uri);
        switch (url?.pathname) {
          case AUTH_PATH:
            await authenticationProvider.handleAuthCallback(url.searchParams);
            break;
          default:
            logger.info(`Scripture Forge extension received a uri at an unknown path: ${uri}`);
            break;
        }
      }),
    );
  }

  const updateServerConfigurationSubscriptionPromise = papi.settings.subscribe(
    'scriptureForge.serverConfiguration',
    (newServerConfiguration) => {
      authenticationProvider.serverConfiguration = newServerConfiguration;
    },
    { retrieveDataImmediately: false },
  );

  const loginCommandPromise = papi.commands.registerCommand('scriptureForge.login', () =>
    authenticationProvider.login(),
  );

  const logoutCommandPromise = papi.commands.registerCommand('scriptureForge.logout', () =>
    authenticationProvider.logout(),
  );

  const isLoggedInCommandPromise = papi.commands.registerCommand('scriptureForge.isLoggedIn', () =>
    authenticationProvider.isLoggedIn(),
  );

  const openScriptureForgeCommandPromise = papi.commands.registerCommand(
    'scriptureForge.openScriptureForge',
    async () => {
      return papi.webViews.openWebView(SCRIPTURE_FORGE_HOME_WEB_VIEW_TYPE, {
        type: 'tab',
      });
    },
  );

  // #endregion

  // #region set up Slingshot PDPF

  const scriptureForgeAPI = new ScriptureForgeAPI(authenticationProvider);

  const slingshotPdpef = new SlingshotProjectDataProviderEngineFactory(scriptureForgeAPI);
  const slingshotPdpefPromise = papi.projectDataProviders.registerProjectDataProviderEngineFactory(
    'scriptureForge.slingshotPdpf',
    SLINGSHOT_PROJECT_INTERFACES,
    slingshotPdpef,
  );

  // #endregion

  // Await registration promises at the end so we don't hold everything else up
  context.registrations.add(
    await homeWebViewProviderPromise,
    await serverConfigurationValidatorPromise,
    await showSlingshotDisclaimerValidatorPromise,
    await updateServerConfigurationSubscriptionPromise,
    await loginCommandPromise,
    await logoutCommandPromise,
    await isLoggedInCommandPromise,
    await openScriptureForgeCommandPromise,
    await slingshotPdpefPromise,
  );

  // On first startup, create or get existing webview if one already exists for this type
  // Do this in an IIFE so we can finish activating and let others start
  (async () => {
    try {
      let hasCompletedFirstStartup = false;
      try {
        hasCompletedFirstStartup = JSON.parse(
          await papi.storage.readUserData(context.executionToken, HAS_COMPLETED_FIRST_STARTUP_KEY),
        );
      } catch (e) {
        // If we couldn't read the data, this is probably first startup
      }
      if (hasCompletedFirstStartup) return;

      // Perform first startup actions
      await papi.webViews.openWebView(homeWebViewProvider.webViewType, undefined, {
        existingId: '?',
      });

      hasCompletedFirstStartup = true;
      // Save that we performed first startup
      await papi.storage.writeUserData(
        context.executionToken,
        HAS_COMPLETED_FIRST_STARTUP_KEY,
        JSON.stringify(hasCompletedFirstStartup),
      );
    } catch (e) {
      logger.warn(`Scripture Forge first startup process threw an error: ${e}`);
    }
  })();
}

export async function deactivate() {
  logger.info('Scripture Forge Extension is deactivating!');
  return true;
}
