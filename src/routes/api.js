import { upnController } from '../controllers/upnController.js';

export default async function (fastify, options) {
    fastify.get('/health', async (request, reply) => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Avtentikacija za vse ostale /api/* klice
    fastify.addHook('preHandler', async (request, reply) => {
        // Preskočimo /api/health preverjanje
        if (request.url === '/api/health' || request.url === '/health') return;

        const validKey = process.env.API_KEY;
        if (!validKey) {
            return reply.status(503).send({
                error: 'Service Unavailable',
                message: 'Avtentikacija ni konfigurirana. Skrbnik mora nastaviti API_KEY.'
            });
        }

        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Expected a Bearer token.'
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token || token !== validKey) {
            return reply.status(403).send({ error: 'Forbidden', message: 'Invalid API key.' });
        }
    });

    const bodySchema = {
        type: 'object',
        properties: {
            amount: { anyOf: [{type: 'string'}, {type: 'number'}] },
            payerName: { type: 'string' },
            payerAddress: { type: 'string' },
            payerCity: { type: 'string' },
            payerPlace: { type: 'string' },
            payerIban: { type: 'string' },
            payerRefCode: { type: 'string' },
            payerRef: { type: 'string' },
            recipientName: { type: 'string' },
            recipientAddress: { type: 'string' },
            recipientCity: { type: 'string' },
            recipientPlace: { type: 'string' },
            recipientIban: { type: 'string' },
            recipientRefCode: { type: 'string' },
            recipientRef: { type: 'string' },
            purposeCode: { type: 'string' },
            purpose: { type: 'string' },
            paymentDate: { type: 'string' },
            dueDate: { type: 'string' },
            urgent: { type: 'boolean' },
            nujno: { type: 'boolean' },
            polog: { type: 'boolean' },
            dvig: { type: 'boolean' },
            humanitarno: { type: 'boolean' },
            mode: { type: 'string', enum: ['placilo', 'humanitarno', 'polog', 'dvig'] },
            currency: { type: 'string' },
            epcBic: { type: 'string' },
            epcInformation: { type: 'string' }
        },
        additionalProperties: true
    };

    fastify.post('/validate', { schema: { body: bodySchema } }, upnController.validate);

    fastify.post('/pdf', { schema: { body: bodySchema } }, (req, rep) => upnController.generatePdf(req, rep, 'exact'));

    fastify.post('/pdf/a4', { schema: { body: bodySchema } }, (req, rep) => upnController.generatePdf(req, rep, 'a4'));

    fastify.post('/qr', { schema: { body: bodySchema } }, upnController.generateQr);

    fastify.post('/epc-qr', { schema: { body: bodySchema } }, upnController.generateEpcQr);

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
            format: { type: 'string', enum: ['exact', 'a4', 'a4-triple'], default: 'exact' }
        },
        required: ['nalogi'],
        additionalProperties: true
    };

    fastify.post('/batch', { schema: { body: batchSchema } }, upnController.processBatch);
}
