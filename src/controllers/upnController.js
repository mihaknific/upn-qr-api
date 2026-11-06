import { Validator } from '../core/validator.js';
import { PdfBuilder } from '../core/pdf-builder.js';
import { QrGenerator } from '../core/qr-generator.js';
import AdmZip from 'adm-zip';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const controllerDirectory = path.dirname(fileURLToPath(import.meta.url));
let pdfFontBytes;
try {
    pdfFontBytes = readFileSync(path.join(controllerDirectory, '..', '..', 'assets', 'fonts', 'Myriad Pro Semibold.ttf'));
} catch (error) {
    console.warn('Could not load Myriad Pro TTF, falling back to Helvetica Bold', error.message);
}

async function processInBatches(items, batchSize, processItem) {
    const results = [];
    for (let start = 0; start < items.length; start += batchSize) {
        const batch = items.slice(start, start + batchSize);
        const batchResults = await Promise.all(
            batch.map((item, index) => processItem(item, start + index))
        );
        results.push(...batchResults);
    }
    return results;
}

export const upnController = {
    async validate(request, reply) {
        const { errors, warnings } = Validator.validateForm(request.body);
        return { valid: errors.length === 0, errors, warnings };
    },

    async generatePdf(request, reply, format = 'exact') {
        const valRes = Validator.validateForm(request.body);
        if (valRes.errors.length > 0) {
            return reply.status(400).send({ error: 'Validation failed', details: valRes.errors });
        }

        try {
            const qrBase64 = await QrGenerator.generateImage(request.body, { format: 'png' });
            const pdfBytes = await PdfBuilder.generateUpnPdf(request.body, {
                format,
                qrBase64,
                fontBytes: pdfFontBytes,
                fontkit
            });

            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `attachment; filename="upn-nalog${format === 'a4' ? '-a4' : ''}.pdf"`);
            return Buffer.from(pdfBytes);
        } catch (err) {
            request.log.error({ err }, 'PDF generation failed');
            return reply.status(400).send({
                error: 'PDF generation failed',
                message: 'PDF ni bilo mogoče ustvariti. Preverite podatke in omejitve UPN QR.'
            });
        }
    },

    async generateQr(request, reply) {
        const isEpc = request.query?.type === 'epc' || request.body?.type === 'epc';

        if (!isEpc) {
            const valRes = Validator.validateForm(request.body);
            if (valRes.errors.length > 0) {
                return reply.status(400).send({ error: 'Validation failed', details: valRes.errors });
            }
        }

        try {
            const qrBase64 = await QrGenerator.generateImage(request.body, {
                format: request.query?.format === 'svg' ? 'svg' : 'png',
                type: isEpc ? 'epc' : 'upn'
            });

            if (request.query?.format === 'svg') {
                reply.header('Content-Type', 'image/svg+xml');
                return qrBase64;
            }

            const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            reply.header('Content-Type', 'image/png');
            return buffer;
        } catch (err) {
            request.log.error({ err }, 'QR generation failed');
            return reply.status(400).send({
                error: 'QR generation failed',
                message: 'QR ni bilo mogoče ustvariti. Preverite podatke in omejitve UPN QR.'
            });
        }
    },

    async generateEpcQr(request, reply) {
        try {
            const qrBase64 = await QrGenerator.generateImage(request.body, {
                format: request.query?.format === 'svg' ? 'svg' : 'png',
                type: 'epc'
            });

            if (request.query?.format === 'svg') {
                reply.header('Content-Type', 'image/svg+xml');
                return qrBase64;
            }

            const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            reply.header('Content-Type', 'image/png');
            return buffer;
        } catch (err) {
            request.log.error({ err }, 'EPC QR generation failed');
            return reply.status(400).send({
                error: 'EPC QR generation failed',
                message: 'EPC QR ni bilo mogoče ustvariti. Preverite podatke in omejitve EPC QR.'
            });
        }
    },

    async processBatch(request, reply) {
        const { nalogi, merge, format } = request.body;
        const targetFormat = format || 'exact'; // 'exact' | 'a4' | 'a4-triple'

        // 1. Batch validate z natančnimi podrobnostmi
        const allErrors = [];
        for (let i = 0; i < nalogi.length; i++) {
            const valRes = Validator.validateForm(nalogi[i]);
            if (valRes.errors.length > 0) {
                allErrors.push({
                    index: i,
                    itemNumber: i + 1,
                    payer: nalogi[i].payerName || '',
                    recipient: nalogi[i].recipientName || '',
                    errors: valRes.errors
                });
            }
        }

        if (allErrors.length > 0) {
            return reply.status(400).send({
                error: 'Batch validation failed',
                totalItems: nalogi.length,
                failedCount: allErrors.length,
                details: allErrors
            });
        }

        try {
            // 2. Vzporedna generacija QR kod (hitrejša obdelava paketov)
            const qrBase64Array = await processInBatches(
                nalogi,
                10,
                nalog => QrGenerator.generateImage(nalog, { format: 'png' })
            );

            // 3. Output logic
            if (merge !== false) {
                // MERGE = TRUE -> 1 združen PDF z več nalogi
                const pdfBytes = await PdfBuilder.generateBatchPdf(nalogi, {
                    format: targetFormat,
                    qrBase64Array,
                    fontBytes: pdfFontBytes,
                    fontkit
                });

                const filename = targetFormat === 'a4-triple'
                    ? 'upn-nalogi-a4-triple-batch.pdf'
                    : `upn-nalogi-batch-${targetFormat}.pdf`;

                reply.header('Content-Type', 'application/pdf');
                reply.header('Content-Disposition', `attachment; filename="${filename}"`);
                return Buffer.from(pdfBytes);
            } else {
                // MERGE = FALSE -> ZIP s posameznimi PDF datotekami (vedno 'exact' ali 'a4')
                const zip = new AdmZip();
                const singleFormat = targetFormat === 'a4-triple' ? 'a4' : targetFormat;

                // Vzporedna generacija posameznih PDF-jev
                const singlePdfs = await processInBatches(
                    nalogi,
                    10,
                    (nalog, i) => PdfBuilder.generateUpnPdf(nalog, {
                        format: singleFormat,
                        qrBase64: qrBase64Array[i],
                        fontBytes: pdfFontBytes,
                        fontkit
                    })
                );

                for (let i = 0; i < nalogi.length; i++) {
                    const safeName = (nalogi[i].recipientRef || nalogi[i].payerName || `nalog-${i+1}`)
                        .replace(/[^a-z0-9_-]/gi, '_')
                        .toLowerCase();
                    zip.addFile(`${String(i + 1).padStart(3, '0')}_${safeName}.pdf`, Buffer.from(singlePdfs[i]));
                }

                const zipBuffer = zip.toBuffer();
                reply.header('Content-Type', 'application/zip');
                reply.header('Content-Disposition', `attachment; filename="upn-nalogi-batch.zip"`);
                return zipBuffer;
            }
        } catch (err) {
            request.log.error({ err }, 'Batch processing failed');
            return reply.status(400).send({
                error: 'Batch processing failed',
                message: 'Paketa ni bilo mogoče obdelati. Preverite podatke in omejitve QR.'
            });
        }
    }
};
