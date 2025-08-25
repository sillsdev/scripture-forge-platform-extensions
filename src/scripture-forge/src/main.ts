import papi, { logger } from '@papi/backend';
import { ExecutionActivationContext, IWebViewProvider } from '@papi/core';
import { formatReplacementString, isString } from 'platform-bible-utils';
import ScriptureForgeAuthenticationProvider, {
  AUTH_PATH,
} from './auth/scripture-forge-authentication-provider.model';
import SecureStorageManager from './auth/secure-storage-manager.model';
import homeWebView from './home/home.web-view?inline';
import tailwindStyles from './tailwind.css?inline';
import { SERVER_CONFIGURATION_PRESET_NAMES } from './auth/server-configuration.model';
import ScriptureForgeApi from './projects/scripture-forge-api.model';
import SlingshotProjectDataProviderEngineFactory from './projects/slingshot-project-data-provider-engine-factory.model';
import { SLINGSHOT_PROJECT_INTERFACES } from './projects/slingshot-project-data-provider-engine.model';

type IWebViewProviderWithType = IWebViewProvider & { webViewType: string };

const SCRIPTURE_FORGE_HOME_WEB_VIEW_TYPE = 'scriptureForge.home';
const SCRIPTURE_FORGE_SLINGSHOT_PDPF_ID = 'scriptureForge.slingshotPdpf';

/** Simple web view provider that provides Scripture Forge Home web views when papi requests them */
const homeWebViewProvider: IWebViewProviderWithType = {
  webViewType: SCRIPTURE_FORGE_HOME_WEB_VIEW_TYPE,
  async getWebView(savedWebView) {
    if (savedWebView.webViewType !== this.webViewType)
      throw new Error(
        `${this.webViewType} provider received request to provide a ${savedWebView.webViewType} web view`,
      );
    return {
      iconUrl: 'papi-extension://scriptureForge/assets/images/sf.svg',
      title: '%scriptureForge_drafts_title%',
      ...savedWebView,
      content: homeWebView,
      styles: tailwindStyles,
      allowPopups: true,
    };
  },
};

export async function activate(context: ExecutionActivationContext) {
  logger.debug('Scripture Forge Extension is activating!');

  const homeWebViewProviderPromise = papi.webViewProviders.registerWebViewProvider(
    homeWebViewProvider.webViewType,
    homeWebViewProvider,
  );

  // #region Validate settings

  const serverConfigurationValidatorPromise = papi.settings.registerValidator(
    'scriptureForge.serverConfiguration',
    async (newConfig) => {
      if (isString(newConfig)) {
        if (!SERVER_CONFIGURATION_PRESET_NAMES.includes(newConfig))
          throw new Error(
            formatReplacementString(
              await papi.localization.getLocalizedString({
                localizeKey:
                  '%settings_scriptureForge_serverConfiguration_validation_error_preset%',
              }),
              {
                presetNames: SERVER_CONFIGURATION_PRESET_NAMES.join(', '),
              },
            ),
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
          await papi.localization.getLocalizedString({
            localizeKey:
              '%settings_scriptureForge_serverConfiguration_validation_error_wrongFormat%',
          }),
        );
      return true;
    },
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

  // #endregion

  // #region set up Slingshot PDPF

  // Exclude the Slingshot PDPF from being included in the Home projects list since drafts need
  // to be opened from Auto Drafts page for now in order to include the header and border. Also
  // we don't keep track of which projects have drafts in a way that Home could not list those
  // without drafts
  const excludePDPFIdsInHome = await papi.settings.get(
    'platformGetResources.excludePdpFactoryIdsInHome',
  );
  if (!excludePDPFIdsInHome.includes(SCRIPTURE_FORGE_SLINGSHOT_PDPF_ID))
    await papi.settings.set(
      'platformGetResources.excludePdpFactoryIdsInHome',
      excludePDPFIdsInHome.concat(SCRIPTURE_FORGE_SLINGSHOT_PDPF_ID),
    );

  // Uncomment the following line to test the extension without access to Scripture Forge
  // const scriptureForgeApi = new ScriptureForgeSampleApi(authenticationProvider);
  const scriptureForgeApi = new ScriptureForgeApi(authenticationProvider);

  const slingshotPdpef = new SlingshotProjectDataProviderEngineFactory(
    scriptureForgeApi,
    sessionChangeEmitter.event,
  );

  context.registrations.add(slingshotPdpef);

  const slingshotPdpefPromise = papi.projectDataProviders.registerProjectDataProviderEngineFactory(
    SCRIPTURE_FORGE_SLINGSHOT_PDPF_ID,
    SLINGSHOT_PROJECT_INTERFACES,
    slingshotPdpef,
  );

  // #endregion

  const openAutoDraftsCommandPromise = papi.commands.registerCommand(
    'scriptureForge.openAutoDrafts',
    async () => {
      return papi.webViews.openWebView(SCRIPTURE_FORGE_HOME_WEB_VIEW_TYPE, {
        type: 'tab',
      });
    },
  );

  // Await registration promises at the end so we don't hold everything else up
  context.registrations.add(
    await homeWebViewProviderPromise,
    await serverConfigurationValidatorPromise,
    await updateServerConfigurationSubscriptionPromise,
    await loginCommandPromise,
    await logoutCommandPromise,
    await isLoggedInCommandPromise,
    await slingshotPdpefPromise,
    await openAutoDraftsCommandPromise,
  );

  // #region first startup actions - disabled for now since this extension is bundled into the app
  // TODO: un-comment this when the extension is not bundled but rather installed from the marketplace

  /* const HAS_COMPLETED_FIRST_STARTUP_KEY = 'hasCompletedFirstStartup';

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
  })(); */

  // #endregion
}

export async function deactivate() {
  logger.debug('Scripture Forge Extension is deactivating!');
  return true;
}
