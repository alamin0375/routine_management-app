// Typed domain errors carried to the client as the §7 envelope
// { error: { code, message, meta? } }. Services throw these; the global
// error handler maps them to HTTP responses — no silent catches anywhere.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    // Machine-readable extras (e.g. { taskCount }) — serialized verbatim.
    public readonly meta?: Record<string, unknown>,
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

export const duplicateCategoryError = () =>
  new AppError(409, 'CATEGORY_NAME_TAKEN', 'You already have a category with this name.');

export const categoryNotEmptyError = (taskCount: number) =>
  new AppError(
    409,
    'CATEGORY_NOT_EMPTY',
    `This category still has ${taskCount} task${taskCount === 1 ? '' : 's'} — reassign them first.`,
    { taskCount },
  );

export const planLimitError = (limit: number, current: number) =>
  new AppError(
    409,
    'PLAN_LIMIT_REACHED',
    `You have reached the limit of ${limit} active tasks on the free plan.`,
    { limit, current },
  );

export const badRequestError = (code: string, message: string) =>
  new AppError(400, code, message);

export const taskNotScheduledError = () =>
  new AppError(409, 'TASK_NOT_SCHEDULED', 'This task does not occur on the given date.');
