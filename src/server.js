import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

export function buildServer() {
    const fastify = Fastify({
        logger: {
            level: 'warn' // da preprečimo smetenje logov med testi
        },
        trustProxy: true, // Nujno za pravilno delovanje Rate Limiterja za Nginx/Docker proxyjem
        bodyLimit: 1048576 // Omejitev JSON payloadov na max 1MB za preprečevanje DoS napadov s prevelikim RAM requestom
    });

    fastify.register(fastifyHelmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "blob:"]
            }
        }
    });

    fastify.register(cors, {
        // V produkciji najprej preveri CORS_ORIGIN, drugače dovoli vse
        origin: process.env.CORS_ORIGIN || '*'
    });

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    fastify.register(fastifyStatic, {
        root: path.join(__dirname, '..', 'public'),
        prefix: '/',
    });

    fastify.register(fastifyRateLimit, {
        max: 100,
        timeWindow: '1 minute'
    });

    fastify.setErrorHandler(function (error, request, reply) {
        if (error.validation) {
            reply.status(400).send({ error: 'Schema validation failed', details: error.validation });
        } else {
            request.log.error(error);
            reply.status(500).send({ error: 'Internal Server Error', message: error.message });
        }
    });

    fastify.register(apiRoutes, { prefix: '/api' });

    return fastify;
}

// Start if executed directly
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = buildServer();
    server.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
        if (err) {
            server.log.error(err);
            process.exit(1);
        }
        console.log(`Server listening at ${address}`);
    });
}
