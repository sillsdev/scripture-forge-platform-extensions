import { WebSocket } from 'partysocket';
import { hasStringProperty, isMessageSendingOp, tryParseJSON } from './utils';

export type ScriptureForgeWebSocketMessage = string | ArrayBuffer | Blob | ArrayBufferView;

/**
 * This class was created to work around a problem with ShareDB and offline support. ShareDB is
 * designed to work with a network that drops and then reconnects, but is not designed to persist
 * data anywhere other than in memory.
 *
 * In order to make submitting an op idempotent, two properties are set on the op:
 *
 * - `src` is set to the value of the `id` property of the connection. (In practice this is usually
 *   omitted because it would be the same as the connection id; see below)
 * - `seq` is set to a monotonically increasing number that is unique to the connection. If an op has
 *   been submitted but not acknowledged, then the op is submitted again, and the server will ignore
 *   the op if it already applied it.
 *
 * If the user closes the browser when an op has been sent and not acknowledged, the op needs to be
 * stored in IndexedDB with the same `src` and `seq` properties so that when the user opens the
 * browser again, the op can be submitted again idempotently. The problem is that ShareDB sets the
 * `seq` property immediately before sending the op, so it is not possible to fully store the op in
 * IndexedDB before the `seq` property is set. There is no event that can be subscribed to that will
 * be triggered after the `seq` property is set and before the op is sent, and we cannot set the
 * `seq` property ourselves when submitting the op to ShareDB (or at least no way was found when
 * this route was investigated).
 *
 * ShareDB is even more lackadaisical about setting the `src` property on the op. When the op is
 * first submitted, the `src` value would be set to the `id` property of the connection, which is
 * known by the server, so ShareDB omits the `src` property and lets the server get the value from
 * the connection. Immediately after submitting the op, ShareDB sets the `src` property to the value
 * of the `id` property of the connection, so that if the op is later sent again after a new
 * connection is established, the op can be correctly ignored.
 *
 * The workaround to these problems is to use a custom websocket adapter that will intercept the
 * connection and store the op in IndexedDB before it is sent. When the op is intercepted it already
 * has the `seq` property set, but lacks the `src` property. To work around this, the `src` property
 * is added to a copy of the op just before it is stored in IndexedDB.
 *
 * - NP, 2023-03-07
 *
 * Notes:
 *
 * - You will need to cast this as a ShareDB Socket to use with a ShareDB Connection.
 * - This differs from the Scripture Forge implementation as it has no preventOpAcknowledgement
 *   support.
 */
export class ShareDBWebsocketAdapter extends WebSocket {
  /** The listeners to call before sending an op. */
  private beforeSendOpListeners: ((collection: string, docId: string) => Promise<void>)[] = [];

  /**
   * Adds a listener that will be called before an op is sent to the server. This allows the op to
   * be stored in IndexedDB before being sent.
   *
   * @param listener The listener
   */
  subscribeToBeforeSendOp(listener: (collection: string, docId: string) => Promise<void>): void {
    this.beforeSendOpListeners.push(listener);
  }

  /**
   * Sends messages on through from the ShareDB client to the websocket, but ignores them if the
   * message is an op and the feature flag to disable sending ops is turned on.
   *
   * If the message is an op and sending ops is not disabled, then the remote store is notified that
   * an op is about to be sent, along with the collection and document id of the op, so that it can
   * be stored in IndexedDB before being sent.
   *
   * @param data The message
   * @returns A promise.
   */
  async send(data: ScriptureForgeWebSocketMessage): Promise<void> {
    const msg: unknown = tryParseJSON(data);
    if (isMessageSendingOp(msg) && hasStringProperty(msg, 'c') && hasStringProperty(msg, 'd'))
      await this.beforeSendOp(msg.c, msg.d);
    super.send(data);
  }

  /**
   * Calls all listeners that have been added to be notified before an op is sent to the server.
   *
   * @param collection The collection that the op is for
   * @param docId The identifier of the document being modified by the op.
   */
  private async beforeSendOp(collection: string, docId: string): Promise<void> {
    await Promise.all(
      this.beforeSendOpListeners.map(async (listener) => listener(collection, docId)),
    );
  }
}
