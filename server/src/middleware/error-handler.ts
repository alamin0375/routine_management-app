import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../services/errors.js';

// Global error handler producing the §7 envelope: { error: { code, message } }.
// AppError → its status/code; ZodError → 400 VALIDATION_ERROR with the first
// field message; anything else → logged in full, generic 500 to the client.
export function errorHandler(
  this: FastifyInstance,
  error: FastifyError | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    void reply
      .status(error.statusCode)
      .send({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    void reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid input.',
      },
    });
    return;
  }

  // Fastify's own errors (bad JSON, 404s from sensible plugins) keep their
  // status; everything unexpected is a 500. Details stay server-side.
  const statusCode = 'statusCode' in error && error.statusCode ? error.statusCode : 500;
  request.log.error(error);
  void reply.status(statusCode).send({
    error: {
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message:
        statusCode >= 500 ? 'Something went wrong on our side — please try again.' : error.message,
    },
  });
}
