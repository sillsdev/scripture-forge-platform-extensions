import { ServerConfiguration, ServerConfigurationPresetNames } from 'scripture-forge';
import {
  AsyncVariable,
  deepEqual,
  Dispose,
  getErrorMessage,
  isString,
  newGuid,
} from 'platform-bible-utils';
import crypto from 'crypto';
import { logger } from '@papi/backend';
import { StatusCodes } from 'http-status-codes';
import SecureStorageManager from './secure-storage-manager.model';

type AuthorizeRequestUrlParams = {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  // TODO: Is this necessary?
  prompt: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  // TODO: Is this necessary?
  audience: string;
};
type AuthorizeResponseUrlParams = {
  state: string;
  code: string;
};
type AuthTokens = {
  accessToken: string;
  /** Time in milliseconds from epoch when the access token will expire. Use `Date.now()` to compare */
  accessTokenExpireTime: number;
  /**
   * Whether the access token has been determined to have expired by some other method than expire
   * time
   */
  didExpire?: boolean;
  refreshToken: string | undefined;
};

type AuthorizationCodeTokenRequestBody = {
  grant_type: 'authorization_code';
  client_id: string;
  redirect_uri: string;
  code: string;
  code_verifier: string;
};
type ResponseTokenSet = {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
};
type AuthorizationCodeTokenResponse = ResponseTokenSet & {
  scope: string;
};
type RefreshTokenRequestBody = {
  grant_type: 'refresh_token';
  client_id: string;
  refresh_token: string;
};
type RefreshTokenResponse = ResponseTokenSet;
type RevokeRefreshTokenRequestBody = {
  client_id: string;
  token: string;
};

/** Path on extension redirect URL for picking up auth response */
export const AUTH_PATH = '/callback/auth0';
/**
 * Names of the presets for server configuration settings - lets the user connect to different sets
 * of servers easily
 */
export const SERVER_CONFIGURATION_PRESET_NAMES: ServerConfigurationPresetNames[] = [
  'dev',
  'qa',
  'live',
];
/** Necessary auth scopes for accessing Slingshot drafts */
const SCOPES = ['openid', 'profile', 'email', 'sf_data', 'offline_access'].join(' ');
/** Auth audience for Scripture Forge...? */
const AUDIENCE = 'https://scriptureforge.org/';

/**
 * Length of cryptographically randomly generated buffer for auth code verifier. 32 bytes in base64
 * is 44 characters. The code verifier must be between 43 and 128 characters.
 */
const CODE_VERIFIER_BUFFER_LENGTH = 32;

/** Sets of configuration for which servers to use */
const SERVER_CONFIGURATIONS: {
  [configuration in ServerConfigurationPresetNames]: ServerConfiguration;
} = {
  dev: {
    scriptureForge: {
      domain: 'localhost',
    },
    auth: {
      domain: 'https://sil-appbuilder.auth0.com',
      clientId: 'aoAGb9Yx1H5WIsvCW6JJCteJhSa37ftH',
    },
  },
  qa: {
    scriptureForge: {
      domain: 'https://qa.scriptureforge.org',
    },
    auth: {
      domain: 'https://dev-sillsdev.auth0.com',
      clientId: '4eHLjo40mAEGFU6zUxdYjnpnC1K1Ydnj',
    },
  },
  live: {
    scriptureForge: {
      domain: 'https://scriptureforge.org',
    },
    auth: {
      domain: 'https://login.languagetechnology.org',
      clientId: 'tY2wXn40fsL5VsPM4uIHNtU6ZUEXGeFn',
    },
  },
};

/**
 * Max time in milliseconds to wait after opening the browser to the authorization site before we
 * receive an authorization code
 */
const AUTHORIZE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function expandServerConfiguration(
  configuration: ServerConfigurationPresetNames | ServerConfiguration,
): ServerConfiguration {
  return isString(configuration) ? SERVER_CONFIGURATIONS[configuration] : configuration;
}

function createAuthorizationCodeAsyncVariable() {
  const authCodeAsyncVariable = new AsyncVariable<string>(
    'scripture-forge-authorize',
    AUTHORIZE_TIMEOUT_MS,
  );
  (async () => {
    try {
      await authCodeAsyncVariable.promise;
    } catch (e) {
      // Needed to make sure the promise rejection does not go unhandled, so just threw something in here
      logger.debug(
        `Authorization code async variable rejected. This may not be a problem. This happens the first time you log in and any time logging in is disrupted. ${getErrorMessage(e)}`,
      );
    }
  })();
  return authCodeAsyncVariable;
}

/**
 * Translates a buffer to a base64 string and "base64 url encodes" it. Note that this is NOT the
 * same as normal url encoding; "base64 url encoding" encodes the string differently.
 *
 * @param buffer Buffer to encode
 * @returns Base64 url encoded string
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function toSha256(buffer: Buffer): Buffer {
  const stuff = crypto.createHash('sha256').update(buffer).digest();
  return stuff;
}

/**
 * Returns time in ms since epoch which is now plus the "expires in" token lifetime converted from
 * seconds to milliseconds
 *
 * @param expiresInSec Access token expiration time from now in seconds
 * @returns Epoch time of when the access token will expire
 */
function getExpireTimeMs(expiresInSec: number): number {
  return Date.now() + expiresInSec * 1000;
}

function getAuthTokensStorageKey(serverConfiguration: ServerConfiguration): string {
  return `${serverConfiguration.auth.domain}${serverConfiguration.auth.clientId}-authTokens`;
}

/**
 * Class that manages authentication with Scripture Forge. Handles logging in, fetching data with
 * authorization, and logging out
 *
 * Thanks to Peter Chapman for providing [sample
 * code](https://github.com/pmachapman/vscode-auth-sample/blob/master/src/auth0AuthenticationProvider.ts)
 */
export default class ScriptureForgeAuthenticationProvider implements Dispose {
  #serverConfiguration: ServerConfiguration;
  #authorizationCodeAsyncVar = createAuthorizationCodeAsyncVariable();
  #authorizeRequestInfo: { state: string; codeVerifier: string } | undefined;
  #authTokens: AuthTokens | undefined;
  /** Whether we have retrieved the tokens from storage for the first time */
  #hasRetrievedAuthTokensFromStorage = false;

  /**
   * @param redirectUri The full uri including path to which the authentication site will redirect
   *   when finished authenticating. If `undefined`, will not be able to log in
   * @param configuration
   * @param storageManager If `undefined`, will not store access token or refresh token
   */
  constructor(
    private redirectUri: string | undefined,
    private openUrl: (url: string) => Promise<void>,
    configuration: ServerConfigurationPresetNames | ServerConfiguration,
    private storageManager: SecureStorageManager | undefined,
    private emitSessionChangeEvent: (event: undefined) => void,
  ) {
    this.#serverConfiguration = expandServerConfiguration(configuration);
  }

  get serverConfiguration(): ServerConfiguration {
    return this.#serverConfiguration;
  }

  set serverConfiguration(configuration: ServerConfigurationPresetNames | ServerConfiguration) {
    const newServerConfiguration = expandServerConfiguration(configuration);
    if (deepEqual(this.#serverConfiguration, newServerConfiguration)) return;

    this.#serverConfiguration = newServerConfiguration;

    this.#authorizeRequestInfo = undefined;
    this.#authTokens = undefined;
    this.#hasRetrievedAuthTokensFromStorage = false;
    this.#authorizationCodeAsyncVar.rejectWithReason(
      'Login canceled because server configuration changed',
    );
    this.emitSessionChangeEvent(undefined);
  }

  /**
   * Receives url redirect to extension's url at {@link AUTH_PATH}. Accepts authorization code and
   * signals to complete the login process
   */
  async handleAuthCallback(searchParams: URLSearchParams): Promise<void> {
    // The next line tests this type to make sure it is correct
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    const authResponseObject = Object.fromEntries(
      searchParams.entries(),
    ) as AuthorizeResponseUrlParams;
    if (!authResponseObject.state || !authResponseObject.code) {
      logger.warn(
        `Authorization code or state missing from auth callback search params ${searchParams}`,
      );
      return;
    }
    if (!this.#authorizeRequestInfo) {
      logger.warn('Authorization request info missing; we are not in the process of logging in');
      return;
    }
    if (authResponseObject.state !== this.#authorizeRequestInfo.state) {
      logger.warn('State mismatch in auth callback; maybe received a callback from an old login');
      return;
    }

    this.#authorizationCodeAsyncVar.resolveToValue(authResponseObject.code);
  }

  /**
   * Determine if the user is logged in to Scripture Forge
   *
   * @returns `true` if the user is logged in, `false` if the user is not logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      if (await this.#getAccessToken()) return true;
    } catch (e) {
      logger.debug(`Error trying to get access token to check if logged in: ${getErrorMessage(e)}`);
    }
    return false;
  }

  /**
   * If not already logged in, logs the user in by opening Scripture Forge's authentication page in
   * browser.
   *
   * Any previous ongoing attempts to log in will be canceled.
   *
   * Throws if unsuccessful.
   *
   * @returns `true` if the user was not already logged in and is now logged in, `false` if the user
   *   was already logged in
   */
  async login(): Promise<boolean> {
    if (!this.redirectUri) throw new Error('Cannot log in without a redirect uri');

    // If already logged in, don't need to log in again
    if (await this.isLoggedIn()) return false;

    // Cancel the old login and start a new one
    this.#authorizationCodeAsyncVar.rejectWithReason('Login canceled because new login started');
    this.#authorizationCodeAsyncVar = createAuthorizationCodeAsyncVariable();

    this.#authorizeRequestInfo = {
      state: newGuid(),
      codeVerifier: base64UrlEncode(crypto.randomBytes(CODE_VERIFIER_BUFFER_LENGTH)),
    };

    const codeChallenge = base64UrlEncode(
      toSha256(Buffer.from(this.#authorizeRequestInfo.codeVerifier)),
    );

    const authorizeParamsObject: AuthorizeRequestUrlParams = {
      response_type: 'code',
      client_id: this.#serverConfiguration.auth.clientId,
      redirect_uri: this.redirectUri,
      scope: SCOPES,
      state: this.#authorizeRequestInfo.state,
      prompt: 'login',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      audience: AUDIENCE,
    };
    const authorizeParams = new URLSearchParams(Object.entries(authorizeParamsObject));

    const authorizeUrl = `${this.#serverConfiguration.auth.domain}/authorize?${authorizeParams}`;
    await this.openUrl(authorizeUrl);

    // Wait for the user to log in
    const authorizationCode = await this.#authorizationCodeAsyncVar.promise;

    // Successfully logged in! Get the access token
    const tokenResponse = await this.#requestAccessTokenUsingAuthorizationCode(authorizationCode);
    // TODO: Handle errors

    await this.#setAuthTokens(tokenResponse);

    return true;
  }

  /**
   * Logs out of Scripture Forge.
   *
   * Throws if unsuccessful.
   */
  async logout(): Promise<void> {
    if (this.#authTokens?.refreshToken !== undefined)
      await this.#revokeRefreshToken(this.#authTokens.refreshToken);
    this.#authorizeRequestInfo = undefined;
    await this.#setAuthTokens(undefined);
  }

  /**
   * Runs `fetch` with Scripture Forge authorization. Attempts to refresh the access token if
   * needed.
   *
   * Throws if not logged in (access token is expired and refresh token doesn't work)
   */
  async fetchWithAuthorization(url: string, options: RequestInit = {}): Promise<Response> {
    const fullUrl = url.startsWith(this.#serverConfiguration.scriptureForge.domain)
      ? url
      : `${this.#serverConfiguration.scriptureForge.domain}${url.startsWith('/') ? '' : '/'}${url}`;
    const accessToken = await this.#getAccessToken();
    const fullOptions = {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
    };
    const response = await fetch(fullUrl, fullOptions);
    if (response.ok) return response;

    if (response.status === StatusCodes.UNAUTHORIZED) {
      try {
        const error = await response.json();
        if (error.error === 'invalid_token') {
          // Access token is invalid. Try refreshing it and retrying the request
          if (this.#authTokens) this.#authTokens.didExpire = true;
          const newAccessToken = await this.#getAccessToken();

          fullOptions.headers = {
            ...options.headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
          // Not awaiting this fetch because we don't want to catch with the following catches. Those
          // apply to the previous asynchronous calls. If we desire to handle errors here, we should
          // make another try/catch around this and then await this
          return fetch(fullUrl, fullOptions);
        }
        throw new Error(`401 unauthorized error while fetching: ${JSON.stringify(error)}`);
      } catch (e) {
        throw new Error(`Error parsing 401 unauthorized error response: ${getErrorMessage(e)}`);
      }
    }
    try {
      const error = await response.text();
      throw new Error(
        `Error fetching with authorization: ${response.status} ${JSON.stringify(error)}`,
      );
    } catch (e) {
      throw new Error(
        `Error reading text from Error response after fetching with authorization: ${response.status} ${response.statusText}`,
      );
    }
  }

  async dispose() {
    this.#authorizationCodeAsyncVar.rejectWithReason(
      'Login canceled because Scripture Forge authentication provider is disposing',
    );

    return true;
  }

  async #setAuthTokens(tokenSet: ResponseTokenSet | undefined): Promise<void> {
    this.#authTokens = tokenSet
      ? {
          accessToken: tokenSet.access_token,
          refreshToken: tokenSet.refresh_token ?? this.#authTokens?.refreshToken,
          accessTokenExpireTime: getExpireTimeMs(tokenSet.expires_in),
        }
      : undefined;
    if (this.storageManager) {
      if (tokenSet) {
        await this.storageManager.set(
          getAuthTokensStorageKey(this.serverConfiguration),
          JSON.stringify(this.#authTokens),
        );
      } else {
        await this.storageManager.delete(getAuthTokensStorageKey(this.serverConfiguration));
      }
    }
    this.emitSessionChangeEvent(undefined);
  }

  /**
   * Gets the current access token for the logged-in user. Retrieves a new access token if the
   * current one expires. Throws if not logged in (access token is expired and refresh token doesn't
   * work)
   */
  async #getAccessToken(): Promise<string> {
    if (!this.#authTokens && !this.#hasRetrievedAuthTokensFromStorage) {
      if (this.storageManager) {
        const authTokensJSON = await this.storageManager.get(
          getAuthTokensStorageKey(this.serverConfiguration),
        );
        if (isString(authTokensJSON)) {
          try {
            this.#authTokens = JSON.parse(authTokensJSON);
          } catch (e) {
            logger.warn(`Error parsing auth tokens from storage: ${getErrorMessage(e)}`);
          }
        }
      }
      this.#hasRetrievedAuthTokensFromStorage = true;
    }
    if (this.#authTokens) {
      if (!this.#authTokens.didExpire && this.#authTokens.accessTokenExpireTime > Date.now())
        return this.#authTokens.accessToken;

      // Access token is expired. Try exchanging refresh token for access token
      const { refreshToken } = this.#authTokens;
      this.#authTokens = undefined;

      if (refreshToken) {
        try {
          const tokenResponse = await this.#requestAccessTokenUsingRefreshToken(refreshToken);

          // TODO: Handle errors

          await this.#setAuthTokens(tokenResponse);

          // We just set this, so bang is fine as it is definitely defined
          // eslint-disable-next-line no-type-assertion/no-type-assertion
          return this.#authTokens!.accessToken;
        } catch (e) {
          throw new Error(`Error refreshing access token: ${getErrorMessage(e)}`);
        }
      }
    }

    throw new Error('Not logged in');
  }

  /**
   * Send a request to get access token and refresh token using the authorization request info we
   * set up in {@link login}
   *
   * @param authorizationCode Code retrieved from user logging in
   */
  async #requestAccessTokenUsingAuthorizationCode(
    authorizationCode: string,
  ): Promise<AuthorizationCodeTokenResponse> {
    if (!this.redirectUri)
      throw new Error('Cannot request authorization code grant without a redirect uri');
    if (!this.#authorizeRequestInfo) throw new Error('Authorization request info missing');

    const authorizationCodeTokenRequestParamsObject: AuthorizationCodeTokenRequestBody = {
      grant_type: 'authorization_code',
      client_id: this.#serverConfiguration.auth.clientId,
      redirect_uri: this.redirectUri,
      code: authorizationCode,
      code_verifier: this.#authorizeRequestInfo.codeVerifier,
    };
    const authorizationCodeTokenRequestParams = new URLSearchParams(
      Object.entries(authorizationCodeTokenRequestParamsObject),
    );

    const authorizationCodeTokenResponse = await fetch(
      `${this.#serverConfiguration.auth.domain}/oauth/token`,
      {
        method: 'POST',
        headers: {
          // Used at https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow/call-your-api-using-the-authorization-code-flow#steps
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `${authorizationCodeTokenRequestParams}`,
      },
    );

    // TODO: handle errors better
    if (!authorizationCodeTokenResponse.ok)
      throw new Error(
        `Error requesting access token with authorization code: ${authorizationCodeTokenResponse.status} ${authorizationCodeTokenResponse.statusText}`,
      );

    return authorizationCodeTokenResponse.json();
  }

  /**
   * Send a request to get access token and refresh token using the refresh token we received
   * previously from getting a new access token
   *
   * @param refreshToken Refresh token received while getting a new access token used to get new
   *   access tokens
   */
  async #requestAccessTokenUsingRefreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const refreshTokenRequestParamsObject: RefreshTokenRequestBody = {
      grant_type: 'refresh_token',
      client_id: this.#serverConfiguration.auth.clientId,
      refresh_token: refreshToken,
    };
    const refreshTokenRequestParams = new URLSearchParams(
      Object.entries(refreshTokenRequestParamsObject),
    );

    const refreshTokenRequestResponse = await fetch(
      `${this.#serverConfiguration.auth.domain}/oauth/token`,
      {
        method: 'POST',
        headers: {
          // Used at https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow/call-your-api-using-the-authorization-code-flow#steps
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `${refreshTokenRequestParams}`,
      },
    );

    // TODO: handle errors better
    if (!refreshTokenRequestResponse.ok)
      throw new Error(
        `Error requesting access token with refresh token: ${refreshTokenRequestResponse.status} ${refreshTokenRequestResponse.statusText}`,
      );

    return refreshTokenRequestResponse.json();
  }

  async #revokeRefreshToken(refreshToken: string): Promise<void> {
    const revokeRefreshTokenRequestBody: RevokeRefreshTokenRequestBody = {
      client_id: this.#serverConfiguration.auth.clientId,
      token: refreshToken,
    };

    const refreshTokenRequestResponse = await fetch(
      `${this.#serverConfiguration.auth.domain}/oauth/revoke`,
      {
        method: 'POST',
        headers: {
          // Used at https://auth0.com/docs/secure/tokens/refresh-tokens/revoke-refresh-tokens#use-the-authentication-api
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(revokeRefreshTokenRequestBody),
      },
    );

    // TODO: handle errors better
    if (!refreshTokenRequestResponse.ok)
      throw new Error(
        `Error revoking refresh token: ${refreshTokenRequestResponse.status} ${refreshTokenRequestResponse.statusText}`,
      );
  }
}
