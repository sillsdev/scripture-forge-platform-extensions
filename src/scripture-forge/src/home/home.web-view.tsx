import papi, { logger } from '@papi/frontend';
import {
  Button,
  Spinner,
  useEvent,
  usePromise,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  MarkdownRenderer,
  Alert,
  AlertTitle,
  AlertDescription,
} from 'platform-bible-react';
import {
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useLocalizedStrings, useSetting } from '@papi/frontend/react';
import { WebViewProps } from '@papi/core';
import {
  formatReplacementString,
  formatReplacementStringToArray,
  getErrorMessage,
  isLocalizeKey,
  isPlatformError,
  isString,
  LocalizeKey,
} from 'platform-bible-utils';
import { AlertCircle } from 'lucide-react';
import ProjectTable from './project-table.component';
import { expandServerConfiguration } from '../auth/server-configuration.model';

const localizedStringKeys: LocalizeKey[] = [
  '%scriptureForge_home_failed_login_check_format%',
  '%scriptureForge_home_failed_login_format%',
  '%scriptureForge_home_failed_logout_format%',
  '%scriptureForge_home_login_action_label%',
  '%scriptureForge_home_logout_action_label%',
  '%scriptureForge_home_description_md%',
  '%scriptureForge_logo_alt_text%',
  '%scriptureForge_overline_title%',
  '%scriptureForge_drafts_title%',
  '%scriptureForge_login_page_title%',
  '%scriptureForge_login_page_subtitle%',
  '%general_error_title%',
  '%scriptureForge_draft_status_notConnected%',
  '%scriptureForge_draft_status_noAccess%',
  '%scriptureForge_draft_status_draftingNotAvailable%',
  '%scriptureForge_draft_status_noFinishedDraft%',
  '%scriptureForge_draft_status_hasFinishedDraft%',
  '%scriptureForge_draft_status_generating%',
  '%scriptureForge_draft_action_cannotSetUp%',
  '%scriptureForge_draft_action_canSetUp%',
  '%scriptureForge_draft_action_canJoin%',
  '%scriptureForge_draft_action_cannotAccessDrafts%',
  '%scriptureForge_draft_action_connected_viewOldDraft%',
  '%scriptureForge_draft_action_connected_viewDraft%',
  '%scriptureForge_draft_action_connected_generate%',
  '%scriptureForge_draft_action_connected_signUpForDrafts%',
  '%scriptureForge_draft_viewer_header_title%',
  '%scriptureForge_draft_viewer_header_description_md%',
  '%scriptureForge_draft_table_header_fullName%',
  '%scriptureForge_draft_table_header_language%',
  '%scriptureForge_draft_table_header_draftStatus%',
  '%scriptureForge_draft_table_header_action%',
];

function ErrorAlert({ title, description }: { title: string; description: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="tw-h-4 tw-w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

globalThis.webViewComponent = function ScriptureForgeHome({
  iconUrl,
  useWebViewState,
}: WebViewProps) {
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });

  const [localizedStrings] = useLocalizedStrings(localizedStringKeys);

  const [serverConfigurationCondensed] = useSetting('scriptureForge.serverConfiguration', 'live');
  if (isPlatformError(serverConfigurationCondensed)) {
    logger.error(
      `Failed to get server configuration, defaulting to "live": ${serverConfigurationCondensed.message}`,
      serverConfigurationCondensed,
    );
  }
  const serverConfiguration = useMemo(
    () =>
      expandServerConfiguration(
        isPlatformError(serverConfigurationCondensed) ? 'live' : serverConfigurationCondensed,
      ),
    [serverConfigurationCondensed],
  );

  const [sessionChangeListener, didChangeSession] = useReducer((x) => x + 1, 0);
  useEvent(
    papi.network.getNetworkEvent<undefined>('scriptureForge.sessionChange'),
    didChangeSession,
  );

  // If we're doing something with login state such that we shouldn't allow the user to log in or out
  const [isLoginBusy, setIsLoginBusy] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState('');

  const [isLoggedIn] = usePromise(
    useCallback(async () => {
      // Needed to use this in the function to add it to the dependency array to get login info again
      // on session change
      // eslint-disable-next-line no-unused-expressions
      sessionChangeListener;

      setLoginErrorMessage('');
      setIsLoginBusy(true);
      let isLoggedInNew = false;
      try {
        isLoggedInNew = await papi.commands.sendCommand('scriptureForge.isLoggedIn');
      } catch (e) {
        // If we haven't gotten the localized string yet, just display the error
        const errorMessage = isLocalizeKey(
          localizedStrings['%scriptureForge_home_failed_login_check_format%'],
        )
          ? getErrorMessage(e)
          : formatReplacementString(
              localizedStrings['%scriptureForge_home_failed_login_check_format%'],
              { errorMessage: getErrorMessage(e) },
            );
        logger.warn(errorMessage);
        if (isMounted.current) setLoginErrorMessage(errorMessage);
      }
      if (isMounted.current) setIsLoginBusy(false);
      return isLoggedInNew;
    }, [localizedStrings, sessionChangeListener]),
    false,
  );

  /**
   * Logs in or out
   *
   * @param shouldLogIn `true` to log in; `false` to log out
   */
  const logInOrOut = async (shouldLogIn: boolean) => {
    try {
      setLoginErrorMessage('');
      setIsLoginBusy(true);
      await (shouldLogIn
        ? papi.commands.sendCommand('scriptureForge.login')
        : papi.commands.sendCommand('scriptureForge.logout'));
    } catch (e) {
      const errorLocalizeKey = shouldLogIn
        ? '%scriptureForge_home_failed_login_format%'
        : '%scriptureForge_home_failed_logout_format%';
      // If we haven't gotten the localized string yet, just display the error
      const errorMessage = isLocalizeKey(localizedStrings[errorLocalizeKey])
        ? getErrorMessage(e)
        : formatReplacementString(localizedStrings[errorLocalizeKey], {
            errorMessage: getErrorMessage(e),
          });
      logger.warn(errorMessage);
      if (isMounted.current) setLoginErrorMessage(errorMessage);
    }
    if (isMounted.current) setIsLoginBusy(false);
  };

  let logInOrOutButtonContents: ReactNode = isLoggedIn
    ? localizedStrings['%scriptureForge_home_logout_action_label%']
    : localizedStrings['%scriptureForge_home_login_action_label%'];
  if (isLoginBusy) logInOrOutButtonContents = <Spinner className="tw-h-4 tw-w-4" />;

  return !isLoggedIn ? (
    <div className="tw-flex tw-bg-sidebar tw-min-h-screen tw-p-2 tw-items-center tw-justify-center">
      <Card className="tw-max-w-md">
        <CardHeader>
          <CardTitle>{localizedStrings['%scriptureForge_login_page_title%']}</CardTitle>
          <CardDescription>
            {localizedStrings['%scriptureForge_login_page_subtitle%']}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formatReplacementStringToArray(
            localizedStrings['%scriptureForge_home_description_md%'],
            {
              loginContent: (
                <Fragment key="loginContent">
                  <Button
                    onClick={() => {
                      logInOrOut(!isLoggedIn);
                    }}
                    disabled={isLoginBusy}
                    variant={isLoggedIn ? 'ghost' : 'default'}
                  >
                    {logInOrOutButtonContents}
                  </Button>
                  {loginErrorMessage && (
                    <ErrorAlert
                      title={localizedStrings['%general_error_title%']}
                      description={loginErrorMessage}
                    />
                  )}
                </Fragment>
              ),
              scriptureForgeUrl: serverConfiguration.scriptureForge.domain,
            },
          ).map((descriptionPortion, i) =>
            isString(descriptionPortion) ? (
              // We have no other way to identify these portions, and they aren't going to change order anyway
              // eslint-disable-next-line react/no-array-index-key
              <MarkdownRenderer key={i} anchorTarget="_blank" markdown={descriptionPortion} />
            ) : (
              descriptionPortion
            ),
          )}
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="tw-flex tw-flex-col tw-h-screen">
      <div className="tw-flex tw-px-4 tw-gap-2 tw-pt-2 tw-pb-1">
        <img
          src={iconUrl}
          alt={localizedStrings['%scriptureForge_logo_alt_text%']}
          className="tw-w-5"
        />
        <div className="tw-text-sm tw-font-semibold">
          {localizedStrings['%scriptureForge_overline_title%']}
        </div>
      </div>
      <div className="tw-flex tw-items-center tw-justify-between tw-w-full tw-px-4 tw-pb-3">
        <div className="tw-text-2xl tw-font-semibold">
          {localizedStrings['%scriptureForge_drafts_title%']}
        </div>
        <Button
          onClick={() => {
            logInOrOut(!isLoggedIn);
          }}
          disabled={isLoginBusy}
          variant={isLoggedIn ? 'ghost' : 'default'}
        >
          {logInOrOutButtonContents}
        </Button>
      </div>
      {loginErrorMessage && (
        <ErrorAlert
          title={localizedStrings['%general_error_title%']}
          description={loginErrorMessage}
        />
      )}
      <div className="tw-flex-1 tw-overflow-auto tw-pt-2 tw-px-1">
        <ProjectTable
          serverConfiguration={serverConfiguration}
          useWebViewState={useWebViewState}
          localizedStrings={localizedStrings}
        />
      </div>
    </div>
  );
};
