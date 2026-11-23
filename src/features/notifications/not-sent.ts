/**
 * Thrown by a sender when it KNOWS nothing went out (the provider refused the message, a bad address).
 * The rows are stamped `failed` and the notice may be retried on a later run while still timely. Any
 * other error is an unknown outcome: the rows stay `pending` and are never sent again.
 *
 * In its own file (moved from channels.ts in N.2) so a sender module can import it without importing
 * channels.ts, which imports the senders: no import cycle. channels.ts re-exports it.
 */
export class NotSentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotSentError";
  }
}
