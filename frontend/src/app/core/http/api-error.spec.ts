import { HttpErrorResponse } from '@angular/common/http';
import { toErrorMessage } from './api-error';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const API_BASE_URL = 'http://localhost:5000/api';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('toErrorMessage', () => {
  it('explains that the server is unreachable when there is no HTTP response (status 0)', () => {
    expect(toErrorMessage(httpError(0, null), API_BASE_URL)).toBe(
      'Cannot reach the game server at http://localhost:5000. Is the backend running?',
    );
  });

  it('does not name a same-origin API, whose relative path means nothing to a player', () => {
    expect(toErrorMessage(httpError(0, null), '/api')).toBe(
      'Cannot reach the game server. Check your connection and try again.',
    );
  });

  it.each([502, 503, 504])(
    'explains a %i gateway error as a server that is starting up or unavailable',
    (status) => {
      expect(toErrorMessage(httpError(status, { title: 'Bad Gateway' }), '/api')).toBe(
        'The game server is starting up or temporarily unavailable. Please try again in a moment.',
      );
    },
  );

  it('shows the ProblemDetails detail, which carries the game rule that was broken', () => {
    const problem = {
      title: 'Invalid move',
      status: 400,
      detail: 'Cell (row 0, col 0) is already taken by X.',
    };

    expect(toErrorMessage(httpError(400, problem), API_BASE_URL)).toBe(
      'Cell (row 0, col 0) is already taken by X.',
    );
  });

  it('falls back to the first validation error when there is no detail', () => {
    const validationProblem = {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { row: ['The row field is required.'], col: ['The col field is required.'] },
    };

    expect(toErrorMessage(httpError(400, validationProblem), API_BASE_URL)).toBe(
      'The row field is required.',
    );
  });

  it('falls back to the title when there is neither detail nor validation errors', () => {
    expect(toErrorMessage(httpError(404, { title: 'Not Found', status: 404 }), API_BASE_URL)).toBe(
      'Not Found',
    );
  });

  it('uses a generic message when the body is not ProblemDetails', () => {
    expect(toErrorMessage(httpError(500, 'Internal Server Error'), API_BASE_URL)).toBe(
      GENERIC_MESSAGE,
    );
  });

  it('uses a generic message for errors that did not come from HttpClient', () => {
    expect(toErrorMessage(new Error('boom'), API_BASE_URL)).toBe(GENERIC_MESSAGE);
  });
});
