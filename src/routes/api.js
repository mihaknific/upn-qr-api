import { upnController } from '../controllers/upnController.js';

export default async function (fastify, options) {
    fastify.get('/health', async (request, reply) => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Avtentikacija za vse ostale /api/* klice
    fastify.addHook('preHandler', async (request, reply) => {
        // Preskočimo /api/health preverjanje
        if (request.url === '/api/health' || request.url === '/health') return;

        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'Unauthorized', message: 'Missing or invalid Authorization header. Expected Bearer token.' });
        }

        const token = authHeader.split(' ')[1];
        const validKey = process.env.API_KEY || 'dev_secret_key_2026';
        if (!token || !validKey || token !== validKey) {
            return reply.status(403).send({ error: 'Forbidden', message: 'Invalid API key.' });
        }
    });

    const bodySchema = {
        type: 'object',
        properties: {
            amount: { anyOf: [{type: 'string'}, {type: 'number'}] },
            payerName: { type: 'string' },
            payerAddress: { type: 'string' },
            payerPlace: { type: 'string' },
            payerIban: { type: 'string' },
            payerRefCode: { type: 'string' },
            payerRef: { type: 'string' },
            recipientName: { type: 'string' },
            recipientAddress: { type: 'string' },
            recipientPlace: { type: 'string' },
            recipientIban: { type: 'string' },
            recipientRefCode: { type: 'string' },
            recipientRef: { type: 'string' },
            purposeCode: { type: 'string' },
            purpose: { type: 'string' },
            paymentDate: { type: 'string' },
            dueDate: { type: 'string' },
            urgent: { type: 'boolean' },
            polog: { type: 'boolean' },
            dvig: { type: 'boolean' },
            humanitarno: { type: 'boolean' },
            currency: { type: 'string' }
        },
        additionalProperties: true // Dopustimo ostala polja, ampak jih validator lahko ignorira.
    };

    fastify.post('/validate', { schema: { body: bodySchema } }, upnController.validate);

    fastify.post('/pdf', { schema: { body: bodySchema } }, (req, rep) => upnController.generatePdf(req, rep, 'exact'));

    fastify.post('/pdf/a4', { schema: { body: bodySchema } }, (req, rep) => upnController.generatePdf(req, rep, 'a4'));

    fastify.post('/qr', { schema: { body: bodySchema } }, upnController.generateQr);

    const batchSchema = {
        type: 'object',
        properties: {
            nalogi: {
                type: 'array',
                items: bodySchema,
                minItems: 1,
                maxItems: 500
            },
            merge: { type: 'boolean', default: true },
            format: { type: 'string', enum: ['exact', 'a4'], default: 'exact' }
        },
        required: ['nalogi'],
        additionalProperties: true
    };

    fastify.post('/batch', { schema: { body: batchSchema } }, upnController.processBatch);
}
