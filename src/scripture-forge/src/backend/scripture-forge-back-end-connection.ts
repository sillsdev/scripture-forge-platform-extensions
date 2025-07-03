import RichText from 'rich-text';
import { Canon, SerializedVerseRef } from '@sillsdev/scripture';
import { logger } from '@papi/backend';
import { Chapter, ScriptureForgeProjectDocument, TextInfo } from 'scripture-forge';
import { AsyncVariable, getErrorMessage } from 'platform-bible-utils';
import {
  Connection,
  createTextId,
  Delta,
  SCRIPTURE_FORGE_CHAPTER_DOCUMENT,
  SCRIPTURE_FORGE_PROJECTS_DOCUMENT,
  SCRIPTURE_FORGE_WSS_BASE_URL,
  ShareDbTypes,
  ShareDbDoc,
  Socket,
} from './rce-utils';
import { ShareDBWebsocketAdapter } from './share-db-websocket-adapter';
import { CustomOriginWebSocket } from './custom-origin-websocket';

let initialized = false;
function initialize() {
  if (initialized) return;
  ShareDbTypes.register(RichText.type);
  initialized = true;
}

let connectionAsyncVariable: AsyncVariable<Connection> | undefined;
let socket: ShareDBWebsocketAdapter | undefined;
const projectDocuments = new Map<string, ShareDbDoc<ScriptureForgeProjectDocument>>();
const chapterDeltas = new Map<string, ShareDbDoc<Delta>>();

async function connect(accessToken: string): Promise<void> {
  if (connectionAsyncVariable) return connectionAsyncVariable.promise.then(() => undefined);
  // 1 minute timeout to initially establish the connection
  connectionAsyncVariable = new AsyncVariable<Connection>('scriptureForgeBackEndConnection', 60000);

  socket = new ShareDBWebsocketAdapter(
    `${SCRIPTURE_FORGE_WSS_BASE_URL}/?access_token=${accessToken}`,
    [],
    {
      // ShareDB handles dropped messages, and buffering them while the socket
      // is closed has undefined behavior
      maxEnqueuedMessages: 0,
      WebSocket: CustomOriginWebSocket,
    },
  );

  socket.onopen = () => {
    logger.debug('RCE stream with SF PDP opened');
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    connectionAsyncVariable?.resolveToValue(new Connection(socket as Socket));
  };

  socket.onclose = () => {
    logger.debug('RCE stream with SF PDP closed');
  };

  socket.onerror = (event) => {
    const errorMsg = `Error occurred in RCE stream with SF PDP: ${event.message}`;
    logger.error(errorMsg);
    connectionAsyncVariable?.rejectWithReason(errorMsg);
  };

  socket.onmessage = (event) => {
    logger.verbose(`RCE stream with SF PDP received message: ${JSON.stringify(event.data)}`);
  };

  return connectionAsyncVariable.promise.then(() => undefined);
}

async function disconnect(): Promise<void> {
  const socketClosedAsyncVariable = new AsyncVariable<void>('sfBackendDisconnect');
  if (socket) {
    socket.onclose = () => {
      socketClosedAsyncVariable.resolveToValue();
    };
  } else {
    socketClosedAsyncVariable.resolveToValue();
  }

  if (connectionAsyncVariable) {
    if (!connectionAsyncVariable.hasSettled)
      connectionAsyncVariable.rejectWithReason('Disconnecting');
    else {
      try {
        const connection = await connectionAsyncVariable.promise;
        connection.close();
      } catch (err) {
        logger.info(`Error while closing connection with SF PDP: ${getErrorMessage(err)}`);
      }
    }
  }
  connectionAsyncVariable = undefined;

  if (socket) {
    socket.close();
    socket = undefined;
  }
  await socketClosedAsyncVariable.promise;

  projectDocuments.clear();
}

async function getProjectDoc(
  projectId: string,
): Promise<ShareDbDoc<ScriptureForgeProjectDocument>> {
  const existingDoc = projectDocuments.get(projectId);
  if (existingDoc) return existingDoc;

  if (!connectionAsyncVariable) throw new Error('Must call connect() before calling this function');

  const connection = await connectionAsyncVariable.promise;
  const docSubscriptionAsyncVar = new AsyncVariable<void>(`SF PDP project ${projectId}`, 30000);
  const newDoc = connection.get(SCRIPTURE_FORGE_PROJECTS_DOCUMENT, projectId);
  newDoc.subscribe((error) => {
    if (error) {
      const errorMsg = `SF PDP error subscribing to project: ${getErrorMessage(error)}`;
      logger.error(errorMsg);
      docSubscriptionAsyncVar.rejectWithReason(errorMsg);
    } else docSubscriptionAsyncVar.resolveToValue();
  });
  newDoc.fetch();
  await docSubscriptionAsyncVar.promise;
  projectDocuments.set(projectId, newDoc);
  return newDoc;
}

async function getChapterDoc(
  projectId: string,
  serializedVerseRef: SerializedVerseRef,
): Promise<ShareDbDoc<Delta>> {
  const textId = createTextId(projectId, serializedVerseRef);
  const existingDoc = chapterDeltas.get(textId);
  if (existingDoc) return existingDoc;

  if (!connectionAsyncVariable) throw new Error('Must call connect() before calling this function');

  const project = await getProjectDoc(projectId);
  if (
    !project.data.texts.find((textInfo: TextInfo) => {
      return (
        Canon.bookNumberToId(textInfo.bookNum) === serializedVerseRef.book &&
        textInfo.chapters.find((chapter: Chapter) => {
          return chapter.number === serializedVerseRef.chapterNum && chapter.isValid;
        })
      );
    })
  ) {
    throw new Error(`Verse ref ${serializedVerseRef} not found in project ${projectId}`);
  } else logger.warn(`Found chapter in SF PDP project: ${JSON.stringify(serializedVerseRef)}`);

  const connection = await connectionAsyncVariable.promise;
  const docSubscriptionAsyncVar = new AsyncVariable<void>(`SF PDP text ${textId}`, 30000);
  const newDoc = connection.get(SCRIPTURE_FORGE_CHAPTER_DOCUMENT, textId);
  newDoc.subscribe((error) => {
    if (error) {
      const errorMsg = `SF PDP error subscribing to document: ${getErrorMessage(error)}`;
      logger.error(errorMsg);
      docSubscriptionAsyncVar.rejectWithReason(errorMsg);
    } else docSubscriptionAsyncVar.resolveToValue();
  });
  newDoc.fetch();
  await docSubscriptionAsyncVar.promise;
  chapterDeltas.set(textId, newDoc);
  return newDoc;
}

/**
 * Represents the connection to the Scripture Forge backend for reading and writing project-related
 * data over the WebSocket.
 */
export const ScriptureForgeBackEndConnection = {
  /**
   * Initializes the backend connection. This method should be called before attempting to connect
   * or perform any operations. It is safe to call multiple times.
   */
  initialize,

  /**
   * Establishes a connection to the Scripture Forge backend. Ensures that the client is ready to
   * interact with the backend services.
   *
   * @param accessToken The token used to authenticate the current user to the backend.
   * @returns Promise that resolves to the Scripture Forge backend. If connect has already been
   *   called, the same promise is returned as the previous time regardless of whether the
   *   accessToken is the same. To change the accessToken, you must disconnect before connecting
   *   again.
   */
  connect,

  /**
   * Disconnects from the Scripture Forge backend. Cleans up resources and terminates the connection
   * gracefully.
   *
   * @returns Promise that resolves once the WebSocket to the Scripture Forge backend has closed.
   */
  disconnect,

  /**
   * Retrieves the project document from the backend.
   *
   * @param projectId The unique identifier of the project to retrieve.
   * @returns A promise that resolves to the ShareDB project document.
   */
  getProjectDoc,

  /**
   * Retrieves the chapter document from the backend.
   *
   * @param projectId The unique identifier of the project to retrieve.
   * @param chapterId The unique identifier of the chapter to retrieve.
   * @returns A promise that resolves to the ShareDB chapter document.
   */
  getChapterDoc,
};
