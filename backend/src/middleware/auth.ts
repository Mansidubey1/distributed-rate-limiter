import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Fastify preHandler hook to enforce admin authentication.
 *
 * Validates `Authorization: Bearer <ADMIN_API_KEY>` against the `ADMIN_API_KEY` environment variable.
 * If `ADMIN_API_KEY` is not set in the environment, allows requests (for local dev convenience),
 * but if set, strictly requires and validates the header.
 */
export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const adminApiKey = process.env.ADMIN_API_KEY;

  // If no ADMIN_API_KEY is configured in the environment, skip auth enforcement
  if (!adminApiKey) {
    return;
  }

  const authHeader = request.headers['authorization'];

  if (!authHeader) {
    return reply.status(401).send({
      error: 'Unauthorized: Missing Authorization header',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return reply.status(401).send({
      error: 'Unauthorized: Invalid Authorization header format (must be Bearer <token>)',
    });
  }

  const token = parts[1];
  if (token !== adminApiKey) {
    return reply.status(401).send({
      error: 'Unauthorized: Invalid admin API key',
    });
  }
}
