import papi, { logger } from '@papi/frontend';
import { useSetting } from '@papi/frontend/react';
import { Button, Spinner, useEvent, usePromise } from 'platform-bible-react';
import { ReactNode, useCallback, useEffect, useReducer, useRef, useState } from 'react';

globalThis.webViewComponent = function ScriptureForgeHome() {
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });

  const [shouldShowSlingshotDisclaimer] = useSetting(
    'scriptureForge.shouldShowSlingshotDisclaimer',
    false,
  );

  const [sessionChangeListener, didChangeSession] = useReducer((x) => x + 1, 0);
  useEvent(
    papi.network.getNetworkEvent<undefined>('scriptureForge.sessionChange'),
    didChangeSession,
  );

  // If we're doing something with login state such that we shouldn't allow the user to log in or out
  const [isLoginBusy, setIsLoginBusy] = useState(false);

  const [isLoggedIn] = usePromise(
    useCallback(async () => {
      // Needed to use this in the function to add it to the dependency array to get login info again
      // on session change
      // eslint-disable-next-line no-unused-expressions
      sessionChangeListener;

      setIsLoginBusy(true);
      const isLoggedInNew = await papi.commands.sendCommand('scriptureForge.isLoggedIn');
      if (isMounted.current) setIsLoginBusy(false);
      return isLoggedInNew;
    }, [sessionChangeListener]),
    false,
  );

  /**
   * Logs in or out
   *
   * @param shouldLogIn `true` to log in; `false` to log out
   */
  const logInOrOut = async (shouldLogIn: boolean) => {
    try {
      setIsLoginBusy(true);
      await (shouldLogIn
        ? papi.commands.sendCommand('scriptureForge.login')
        : papi.commands.sendCommand('scriptureForge.logout'));
      if (isMounted.current) setIsLoginBusy(false);
    } catch (e) {
      logger.warn(`Scripture Forge Home failed to log ${shouldLogIn ? 'in' : 'out'}`, e);
    }
  };

  let logInOrOutButtonContents: ReactNode = isLoggedIn ? 'Log out' : 'Log in';
  if (isLoginBusy) logInOrOutButtonContents = <Spinner />;

  return (
    <div>
      <h1>Scripture Forge Home</h1>
      <p>Welcome to Scripture Forge!</p>
      {shouldShowSlingshotDisclaimer && (
        <p>TODO: Slingshot Disclaimer. Add OK button and Do not show again button</p>
      )}
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
  );
};
