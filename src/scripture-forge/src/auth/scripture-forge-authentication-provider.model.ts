import { ServerConfiguration, ServerConfigurationPresetNames } from 'scripture-forge';
import {
  AsyncVariable,
  deepEqual,
  Dispose,
  getErrorMessage,
  isString,
  Mutex,
  newGuid,
} from 'platform-bible-utils';
import crypto from 'crypto';
import { logger } from '@papi/backend';
import { StatusCodes } from 'http-status-codes';
import SecureStorageManager from './secure-storage-manager.model';
import { expandServerConfiguration } from './server-configuration.model';

type AuthorizeRequestUrlParams = {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  prompt: string;
  code_challenge: string;
  code_challenge_method: 'S256';
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

/** Necessary auth scopes for accessing Slingshot drafts */
const SCOPES = ['openid', 'profile', 'email', 'sf_data', 'offline_access'].join(' ');
/** Auth audience for Scripture Forge...? */
const AUDIENCE = 'https://scriptureforge.org/';

/**
 * Length of cryptographically randomly generated buffer for auth code verifier. 32 bytes in base64
 * is 44 characters. The code verifier must be between 43 and 128 characters.
 */
const CODE_VERIFIER_BUFFER_LENGTH = 32;

/**
 * Max time in milliseconds to wait after opening the browser to the authorization site before we
 * receive an authorization code
 */
const AUTHORIZE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function createAuthorizationCodeAsyncVariable() {
  const authCodeAsyncVariable = new AsyncVariable<string>(
    'scripture-forge-authorize',
    AUTHORIZE_TIMEOUT_MS,
  );
  (async () => {
    try {
      await authCodeAsyncVariable.promise;
    } catch (e) {
      // Making sure the promise rejection does not go unhandled
      logger.warn(
        `Authorization code async variable rejected. Logging in was probably disrupted. ${getErrorMessage(e)}`,
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
  #authorizeRequestInfo:
    | {
        state: string;
        codeVerifier: string;
        /** Variable holding promise resolving to the authorization code */
        authorizationCodeAsyncVar: AsyncVariable<string>;
      }
    | undefined;

  /** Mutex for handling auth tokens operations one at a time */
  #authTokensMutex = new Mutex();
  #authTokens: AuthTokens | undefined;
  /** Whether we have retrieved the tokens from storage for the first time */
  #hasRetrievedAuthTokensFromStorage = false;

  /**
   * @param redirectUri The full uri including path to which the authentication site will redirect
   *   when finished authenticating. If `undefined`, will not be able to log in
   * @param openUrl Function used to open the oauth authorization code url in browser
   * @param configuration Settings for which server to interact with
   * @param storageManager If `undefined`, will not store access token or refresh token
   * @param emitSessionChangeEvent Function to run to announce that the session changed
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

    this.#authorizeRequestInfo?.authorizationCodeAsyncVar.rejectWithReason(
      'Login canceled because server configuration changed',
    );
    this.#authorizeRequestInfo = undefined;
    this.#authTokensMutex.cancel();
    this.#authTokens = undefined;
    this.#hasRetrievedAuthTokensFromStorage = false;
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
    if (this.#authorizeRequestInfo.authorizationCodeAsyncVar.hasSettled) {
      logger.warn(
        'Authorization code async var has already settled; we already completed the log in process',
      );
      return;
    }

    this.#authorizeRequestInfo.authorizationCodeAsyncVar.resolveToValue(authResponseObject.code);
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
    this.#authorizeRequestInfo?.authorizationCodeAsyncVar.rejectWithReason(
      'Login canceled because new login started',
    );

    try {
      this.#authorizeRequestInfo = {
        state: newGuid(),
        codeVerifier: base64UrlEncode(crypto.randomBytes(CODE_VERIFIER_BUFFER_LENGTH)),
        authorizationCodeAsyncVar: createAuthorizationCodeAsyncVariable(),
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
      const authorizationCode = await this.#authorizeRequestInfo.authorizationCodeAsyncVar.promise;

      // Successfully logged in! Get the access token
      this.#authTokensMutex.runExclusive(async () => {
        const tokenResponse =
          await this.#requestAccessTokenUsingAuthorizationCode(authorizationCode);

        await this.#setAuthTokens(tokenResponse);
      });

      return true;
    } catch (e) {
      // Something went wrong. Clean up login process and throw
      this.#authorizeRequestInfo = undefined;
      this.#setAuthTokens(undefined);
      throw e;
    }
  }

  /**
   * Logs out of Scripture Forge.
   *
   * Throws if unsuccessful.
   *
   * @param force Removes local authentication information regardless of whether it successfully
   *   revoked the refresh token on the server. Useful if you are sure the server already considers
   *   this user to be logged out
   */
  async logout(force = false): Promise<void> {
    const removeLoginState = async () => {
      this.#authorizeRequestInfo = undefined;
      await this.#setAuthTokens(undefined);
    };

    await this.#authTokensMutex.runExclusive(async () => {
      try {
        if (this.#authTokens?.refreshToken !== undefined)
          await this.#revokeRefreshToken(this.#authTokens.refreshToken);
      } catch (e) {
        if (force) await removeLoginState();
        throw e;
      }
      await removeLoginState();
    });
  }

  /**
   * Runs [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch) with Scripture
   * Forge authorization. Attempts to refresh the access token if needed. Logs out automatically if
   * unauthorized.
   *
   * Throws if something went wrong with setting up and running the fetch, like no internet, not
   * logged in, or access token is expired and refresh token doesn't work so we don't even have an
   * access token to use
   */
  async fetchWithAuthorization(url: string, options: RequestInit = {}): Promise<Response> {
    const fullUrl = url.startsWith(this.#serverConfiguration.scriptureForge.domain)
      ? url
      : `${this.#serverConfiguration.scriptureForge.domain}${url.startsWith('/') ? '' : '/'}${url}`;
    logger.debug(`SF Auth provider fetching with authorization: ${fullUrl}`);
    const accessToken = await this.#getAccessToken();
    const fullOptions = {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
    };
    const response = await fetch(fullUrl, fullOptions);
    if (response.ok || response.status !== StatusCodes.UNAUTHORIZED) return response;

    /** Special JSON-based response contents from failed fetch */
    let error: { error: string };
    try {
      error = await response.json();
    } catch (e) {
      logger.debug(
        `Error parsing ${response.status} ${response.statusText} error response from ${fullUrl}. This probably means it was not a typical OAuth unauthorized error response indicating our access token expired. Logging out and returning the response instead of trying to retrieve a new access token. ${getErrorMessage(e)}`,
      );

      // Log out since we got unauthorized and not invalid token
      try {
        await this.logout(true);
      } catch (err) {
        logger.warn(
          `Failed to log out after ${response.status} ${response.statusText} error response from ${fullUrl}. ${getErrorMessage(err)}`,
        );
      }

      return response;
    }

    // If the error is not an invalid access token, log out and return the response
    if (error.error !== 'invalid_token') {
      try {
        await this.logout(true);
      } catch (err) {
        logger.warn(
          `Failed to log out after ${response.status} ${response.statusText} error response that is not invalid_token from ${fullUrl}. ${getErrorMessage(err)}`,
        );
      }
      return response;
    }

    // Access token is invalid. Try refreshing it and retrying the request
    logger.debug(
      `${response.status} ${response.statusText} error from ${fullUrl}: the access token is expired. Will try requesting a new token. Full response: ${JSON.stringify(error)}`,
    );

    let newAccessToken: string;
    try {
      newAccessToken = await this.#authTokensMutex.runExclusive(async () => {
        if (this.#authTokens) this.#authTokens.didExpire = true;
        return this.#getAccessToken(false);
      });
    } catch (e) {
      throw new Error(
        `Error while requesting a new access token while fetching ${fullUrl}. ${getErrorMessage(e)}`,
      );
    }

    fullOptions.headers = {
      ...options.headers,
      Authorization: `Bearer ${newAccessToken}`,
    };
    try {
      const newResponse = await fetch(fullUrl, fullOptions);

      // For some reason, after getting a new access token, still unauthorized. Log out and return the response
      if (newResponse.status === StatusCodes.UNAUTHORIZED) {
        try {
          await this.logout(true);
        } catch (err) {
          logger.warn(
            `Failed to log out after second ${newResponse.status} ${newResponse.statusText} error response from ${fullUrl} after getting a new access token. ${getErrorMessage(err)}`,
          );
        }
      }

      return newResponse;
    } catch (e) {
      throw new Error(
        `Error while fetching ${fullUrl} after retrieving a new access token. ${getErrorMessage(e)}`,
      );
    }
  }

  async dispose() {
    this.#authorizeRequestInfo?.authorizationCodeAsyncVar.rejectWithReason(
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
   * current one expires. Throws if not logged in, access token is expired and refresh token doesn't
   * work, or failed to get access token in some other way
   */
  async #getAccessToken(shouldAcquireLock = true): Promise<string> {
    const getAccessTokenInternal = async () => {
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
      if (!this.#authTokens) throw new Error('Not logged in');

      if (!this.#authTokens.didExpire && this.#authTokens.accessTokenExpireTime > Date.now())
        return this.#authTokens.accessToken;

      // Access token is expired. Try exchanging refresh token for access token
      const { refreshToken } = this.#authTokens;
      // Remove auth tokens but don't send an update yet as we don't know what update to send
      this.#authTokens = undefined;

      if (!refreshToken) {
        // If the access token is expired and there isn't a refresh token, finalize the removal
        // of the auth tokens and send an update
        await this.#setAuthTokens(undefined);
        throw new Error('No refresh token; not logged in');
      }

      let tokenResponse: ResponseTokenSet;
      try {
        const tokenSetOrStatusCode = await this.#requestAccessTokenUsingRefreshToken(refreshToken);

        if (tokenSetOrStatusCode === StatusCodes.UNAUTHORIZED) {
          // Not authorized to get new access token, so log out
          try {
            await this.logout(true);
          } catch (err) {
            logger.warn(
              `Failed to log out after ${tokenSetOrStatusCode} refreshing access token. ${getErrorMessage(err)}`,
            );
          }
        }

        if (typeof tokenSetOrStatusCode === 'number')
          throw new Error(`Refresh request responded with error code ${tokenSetOrStatusCode}`);

        tokenResponse = tokenSetOrStatusCode;
      } catch (e) {
        throw new Error(`Error refreshing access token: ${getErrorMessage(e)}`);
      }

      await this.#setAuthTokens(tokenResponse);

      // We just set this, so bang is fine as it is definitely defined
      // eslint-disable-next-line no-type-assertion/no-type-assertion
      return this.#authTokens!.accessToken;
    };

    if (shouldAcquireLock) return this.#authTokensMutex.runExclusive(getAccessTokenInternal);
    return getAccessTokenInternal();
  }

  // #region OAuth requests
  // TODO: consider factoring out into another file after seeing how the error handling integrates

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
  async #requestAccessTokenUsingRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenResponse | StatusCodes> {
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

    if (!refreshTokenRequestResponse.ok) return refreshTokenRequestResponse.status;

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

    if (!refreshTokenRequestResponse.ok)
      throw new Error(
        `Error revoking refresh token: ${refreshTokenRequestResponse.status} ${refreshTokenRequestResponse.statusText}`,
      );
  }

  // #endregion
}
