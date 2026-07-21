// Typed domain errors carried to the client as the §7 envelope
// { error: { code, message } }. Services throw these; the global error
// handler maps them to HTTP responses — no silent catches anywhere.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const emailTakenError = () =>
  new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');

export const invalidCredentialsError = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');

export const invalidRefreshTokenError = () =>
  new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired — please log in again.');

export const unauthorizedError = () =>
  new AppError(401, 'UNAUTHORIZED', 'You must be logged in to do that.');

// Also used for ownership violations — a resource that exists but belongs to
// another user is indistinguishable from one that doesn't exist (§4: 404,
// never 403, so ids can't be probed).
export const notFoundError = (resource = 'Resource') =>
  new AppError(404, 'NOT_FOUND', `${resource} not found.`);
