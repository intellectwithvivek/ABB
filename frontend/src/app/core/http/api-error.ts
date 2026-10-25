import { HttpErrorResponse } from '@angular/common/http';

/** The RFC 7807 fields the backend sends; `errors` is only present on validation failures. */
interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

const SERVER_UNAVAILABLE_MESSAGE =
  'The game server is starting up or temporarily unavailable. Please try again in a moment.';

/** Gateway statuses a proxy returns while the API is waking up, restarting or down. */
const SERVER_UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/**
 * Turns any error thrown by an API call into one sentence a player can read.
 * `apiBaseUrl` names the server in the "cannot reach" message during local development.
 */
export function toErrorMessage(error: unknown, apiBaseUrl: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return GENERIC_MESSAGE;
  }
  // Status 0 means no HTTP response at all: server down, wrong port or CORS rejection.
  if (error.status === 0) {
    return unreachableMessage(apiBaseUrl);
  }
  if (SERVER_UNAVAILABLE_STATUSES.has(error.status)) {
    return SERVER_UNAVAILABLE_MESSAGE;
  }
  const problem = asProblemDetails(error.error);
  return problem.detail ?? firstValidationError(problem) ?? problem.title ?? GENERIC_MESSAGE;
}

/** Names the server only for an absolute URL; a same-origin path such as '/api' is not shown. */
function unreachableMessage(apiBaseUrl: string): string {
  return /^https?:\/\//.test(apiBaseUrl)
    ? `Cannot reach the game server at ${new URL(apiBaseUrl).origin}. Is the backend running?`
    : 'Cannot reach the game server. Check your connection and try again.';
}

function asProblemDetails(body: unknown): ProblemDetails {
  return typeof body === 'object' && body !== null ? (body as ProblemDetails) : {};
}

function firstValidationError(problem: ProblemDetails): string | undefined {
  return Object.values(problem.errors ?? {}).flat()[0];
}
