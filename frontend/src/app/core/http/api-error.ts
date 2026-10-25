import { HttpErrorResponse } from '@angular/common/http';

/** The RFC 7807 fields the backend sends; `errors` is only present on validation failures. */
interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Turns any error thrown by an API call into one sentence a player can read.
 * `apiBaseUrl` names the server in the "cannot reach" message.
 */
export function toErrorMessage(error: unknown, apiBaseUrl: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return GENERIC_MESSAGE;
  }
  // Status 0 means no HTTP response at all: server down, wrong port or CORS rejection.
  if (error.status === 0) {
    return `Cannot reach the game server at ${serverAddress(apiBaseUrl)}. Is the backend running?`;
  }
  const problem = asProblemDetails(error.error);
  return problem.detail ?? firstValidationError(problem) ?? problem.title ?? GENERIC_MESSAGE;
}

/** The origin of an absolute API URL; a same-origin path such as '/api' is shown as it is. */
function serverAddress(apiBaseUrl: string): string {
  return /^https?:\/\//.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : apiBaseUrl;
}

function asProblemDetails(body: unknown): ProblemDetails {
  return typeof body === 'object' && body !== null ? (body as ProblemDetails) : {};
}

function firstValidationError(problem: ProblemDetails): string | undefined {
  return Object.values(problem.errors ?? {}).flat()[0];
}
