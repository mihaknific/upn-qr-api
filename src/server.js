import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { readFile } from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

export function buildServer() {
    const bodyLimit = parseInt(process.env.BODY_LIMIT, 10) || 10485760; // 10MB privzeto za večje pakete računov
    const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;
    const trustedProxies = (process.env.TRUSTED_PROXIES || '')
        .split(',')
        .map(proxy => proxy.trim())
        .filter(Boolean);

    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'warn'
        },
        trustProxy: trustedProxies.length ? trustedProxies : false,
        bodyLimit
    });

    fastify.register(fastifyHelmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "blob:"],
                frameSrc: ["'self'", "blob:"]
            }
        }
    });

    const corsOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    if (corsOrigins.length) {
        fastify.register(cors, { origin: corsOrigins });
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    fastify.register(fastifyStatic, {
        root: path.join(__dirname, '..', 'public'),
        prefix: '/',
    });

    fastify.register(fastifyRateLimit, {
        max: rateLimitMax,
        timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute'
    });

    // Root-level healthcheck za Docker in load balancerje
    fastify.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString()
    }));

    const sampleFiles = {
        'primer-enojni-nalog.json': ['primer-enojni-nalog.json', 'application/json'],
        'primer-batch-3-racuni.json': ['primer-batch-3-racuni.json', 'application/json'],
        'primer-batch-3-racuni.csv': ['primer-batch-3-racuni.csv', 'text/csv; charset=utf-8']
    };
    fastify.get('/samples/:filename', async (request, reply) => {
        const sample = Object.hasOwn(sampleFiles, request.params.filename)
            ? sampleFiles[request.params.filename]
            : null;
        if (!sample) {
            return reply.status(404).send({
                error: 'Not Found',
                message: 'Zahtevani testni primer ne obstaja.'
            });
        }

        const [filename, contentType] = sample;
        const contents = await readFile(path.join(__dirname, '..', filename));
        return reply.type(contentType).send(contents);
    });

    fastify.setErrorHandler(function (error, request, reply) {
        if (error.validation) {
            // Prijazno oblikovanje napak validacije sheme
            const details = error.validation.map(v => {
                const field = v.instancePath ? v.instancePath.replace(/^\//, '') : (v.params?.missingProperty || '');
                return {
                    field: field || 'splošno',
                    msg: `Neveljavna vrednost polja (${v.message}).`
                };
            });
            return reply.status(400).send({
                error: 'Schema validation failed',
                message: 'Podatki zahteve niso v skladu s pričakovano JSON shemo.',
                details
            });
        }

        if (error.statusCode === 400 || error instanceof SyntaxError) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'Neveljaven format zahteve ali neveljavna JSON sintaksa. Preverite poslane podatke.'
            });
        }

        if (error.statusCode === 413) {
            return reply.status(413).send({
                error: 'Payload Too Large',
                message: 'Poslan paket podatkov je prevelik. Za povečanje limita nastavite okoljsko spremenljivko BODY_LIMIT.'
            });
        }

        if (error.statusCode === 429) {
            return reply.status(429).send({
                error: 'Too Many Requests',
                message: 'Presegli ste dovoljeno število klicev na minuto. Poskusite ponovno čez trenutek ali prilagodite RATE_LIMIT_MAX.'
            });
        }

        request.log.error(error);
        reply.status(error.statusCode || 500).send({
            error: error.name || 'Internal Server Error',
            message: error.statusCode && error.statusCode < 500
                ? error.message
                : 'Prišlo je do nepričakovane napake na strežniku.'
        });
    });

    // Prijazno obvestilo ob napačnem URL naslovu (404)
    fastify.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            error: 'Not Found',
            message: `Zahtevana pot '${request.method} ${request.url}' ne obstaja.`,
            razpolozljivePoti: [
                'GET  /health',
                'GET  /api/health',
                'POST /api/validate',
                'POST /api/pdf',
                'POST /api/pdf/a4',
                'POST /api/qr',
                'POST /api/epc-qr',
                'POST /api/batch'
            ]
        });
    });

    fastify.register(apiRoutes, { prefix: '/api' });

    return fastify;
}

// Zagon strežnika, če je zagnan neposredno
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = buildServer();
    const port = parseInt(process.env.PORT, 10) || 3000;
    const host = process.env.HOST || '127.0.0.1';

    server.listen({ port, host }, (err, address) => {
        if (err) {
            server.log.error(err);
            process.exit(1);
        }
        console.log(`UPN QR API strežnik posluša na ${address}`);
    });

    // Prijazen izklop ob prekinitvah (SIGINT / SIGTERM v vsebnikih)
    const gracefulShutdown = async (signal) => {
        server.log.info(`Prejet signal ${signal}, zapiranje strežnika...`);
        try {
            await server.close();
            process.exit(0);
        } catch (error) {
            server.log.error(error, 'Graceful shutdown failed');
            process.exit(1);
        }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
