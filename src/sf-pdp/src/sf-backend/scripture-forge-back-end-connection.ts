import RichText from 'rich-text';
import { Canon, SerializedVerseRef } from '@sillsdev/scripture';
import { Chapter, ScriptureForgeProjectDocument, TextInfo } from 'scripture-forge';
import { AsyncVariable, getErrorMessage } from 'platform-bible-utils';
import {
  Connection,
  createTextId,
  Delta,
  SCRIPTURE_FORGE_CHAPTER_DOCUMENT,
  SCRIPTURE_FORGE_PROJECTS_DOCUMENT,
  ShareDbTypes,
  ShareDbDoc,
  Socket,
} from './rce-utils';
import { ShareDBWebsocketAdapter } from './share-db-websocket-adapter';
import { CustomOriginWebSocket } from './custom-origin-websocket';
import * as logger from '../log';

// Timeout for connecting and retrieving documents
const SF_TIMEOUT_MS = 60000;

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

async function connect(wssBaseUrl: string, accessToken: string): Promise<void> {
  if (connectionAsyncVariable) {
    await connectionAsyncVariable.promise;
    return;
  }

  initialize();

  connectionAsyncVariable = new AsyncVariable<Connection>('SF PDP connect', SF_TIMEOUT_MS);

  socket = new ShareDBWebsocketAdapter(`${wssBaseUrl}/?access_token=${accessToken}`, [], {
    // ShareDB handles dropped messages, and buffering them while the socket
    // is closed has undefined behavior
    maxEnqueuedMessages: 0,
    WebSocket: CustomOriginWebSocket,
  });

  // Socket requires onopen
  const originalOnOpen = socket.onopen;
  socket.onopen = (event) => {
    // ShareDB's minimal WebSocket interface that we ensure is implemented in this function
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    if (socket) connectionAsyncVariable?.resolveToValue(new Connection(socket as Socket));
    logger.info('RCE stream with SF PDP opened');
    if (originalOnOpen) originalOnOpen(event);
  };

  // Socket requires onclose
  const originalOnClose = socket.onclose;
  if (!originalOnClose) {
    socket.onclose = () => {
      logger.info('RCE stream with SF PDP closed');
    };
  }

  // Socket requires onerror
  const originalOnError = socket.onerror;
  socket.onerror = (event) => {
    const errorMsg = `Error occurred in RCE stream with SF PDP: ${event.message}`;
    logger.error(errorMsg);
    if (connectionAsyncVariable && !connectionAsyncVariable.hasSettled)
      connectionAsyncVariable.rejectWithReason(errorMsg);
    if (originalOnError) originalOnError(event);
  };

  // Socket requires onmessage
  const originalOnMessage = socket.onmessage;
  if (!originalOnMessage) {
    socket.onmessage = () => {
      logger.verbose('RCE stream with SF PDP received message');
    };
  }

  // Don't return the connection object (keep it private)
  await connectionAsyncVariable.promise;
}

async function disconnect(): Promise<void> {
  const socketClosedAsyncVariable = new AsyncVariable<void>('SF PDP disconnect', SF_TIMEOUT_MS);
  if (socket) {
    const originalOnClose = socket.onclose;
    socket.onclose = (event: CloseEvent) => {
      socketClosedAsyncVariable.resolveToValue();
      if (originalOnClose) originalOnClose(event);
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
        logger.warn(`Error while closing connection with SF PDP: ${getErrorMessage(err)}`);
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
  const projectAsyncVar = new AsyncVariable<void>(`SF PDP project ${projectId}`, SF_TIMEOUT_MS);
  const newDoc = connection.get(SCRIPTURE_FORGE_PROJECTS_DOCUMENT, projectId);
  newDoc.subscribe((error) => {
    if (error) {
      const errorMsg = `SF PDP error subscribing to project: ${getErrorMessage(error)}`;
      logger.error(errorMsg);
      projectAsyncVar.rejectWithReason(errorMsg);
    } else projectAsyncVar.resolveToValue();
  });
  newDoc.fetch();
  await projectAsyncVar.promise;
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
  )
    throw new Error(`Verse ref ${serializedVerseRef} not found in project ${projectId}`);

  const connection = await connectionAsyncVariable.promise;
  const docSubscriptionAsyncVar = new AsyncVariable<void>(`SF PDP text ${textId}`, SF_TIMEOUT_MS);
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
   * Establishes a connection to the Scripture Forge backend. Ensures that the client is ready to
   * interact with the backend services.
   *
   * @param wssBaseUrl The base WebSocket URL for the Scripture Forge backend.
   * @param accessToken The token used to authenticate the current user to the backend.
   * @returns Promise that resolves once the connection is established. If connect has already been
   *   called, the same promise is returned as the previous time regardless of whether the
   *   parameters are the same. To change the connection parameters, you must disconnect before
   *   connecting again.
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
   * @param serializedVerseRef The serialized verse reference specifying the book and chapter to
   *   retrieve.
   * @returns A promise that resolves to the ShareDB chapter document.
   */
  getChapterDoc,
};
