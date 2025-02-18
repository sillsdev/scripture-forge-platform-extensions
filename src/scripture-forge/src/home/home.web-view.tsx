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
  Label,
} from 'platform-bible-react';
import { ReactNode, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import ProjectTable from './project-table.component';

globalThis.webViewComponent = function ScriptureForgeHome() {
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });

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
  if (isLoginBusy) logInOrOutButtonContents = <Spinner className="tw-h-4 tw-w-4" />;

  return !isLoggedIn ? (
    <div className="tw-flex tw-bg-muted/50 tw-h-screen tw-items-center tw-justify-center">
      <Card className="tw-max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Scripture Forge!</CardTitle>
          <CardDescription>Click the button below to login</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              logInOrOut(!isLoggedIn);
            }}
            disabled={isLoginBusy}
            variant={isLoggedIn ? 'ghost' : 'default'}
          >
            {logInOrOutButtonContents}
          </Button>
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="tw-flex tw-flex-col tw-h-screen">
      <div className="tw-flex tw-items-center tw-justify-between tw-w-full tw-h-16 tw-px-4">
        <Label className="tw-text-2xl tw-font-semibold">My Scripture Forge Projects</Label>
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
      <div className="tw-flex-1 tw-overflow-auto tw-pt-2 tw-px-1">
        <ProjectTable />
      </div>
    </div>
  );
};
