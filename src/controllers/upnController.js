import { Validator } from '../core/validator.js';
import { PdfBuilder } from '../core/pdf-builder.js';
import { QrGenerator } from '../core/qr-generator.js';
import AdmZip from 'adm-zip';

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
        
        const qrBase64 = await QrGenerator.generateImage(request.body, { format: 'png' });
        const pdfBytes = await PdfBuilder.generateUpnPdf(request.body, { format, qrBase64 });
        
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="upn-nalog${format === 'a4' ? '-a4' : ''}.pdf"`);
        return Buffer.from(pdfBytes);
    },

    async generateQr(request, reply) {
        const valRes = Validator.validateForm(request.body);
        if (valRes.errors.length > 0) {
            return reply.status(400).send({ error: 'Validation failed', details: valRes.errors });
        }
        
        const qrBase64 = await QrGenerator.generateImage(request.body, { format: 'png' });
        const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        reply.header('Content-Type', 'image/png');
        return buffer;
    },

    async processBatch(request, reply) {
        const { nalogi, merge, format } = request.body;
        
        // 1. Batch validate
        const allErrors = [];
        for (let i = 0; i < nalogi.length; i++) {
            const valRes = Validator.validateForm(nalogi[i]);
            if (valRes.errors.length > 0) {
                allErrors.push({ index: i, errors: valRes.errors });
            }
        }
        
        if (allErrors.length > 0) {
            return reply.status(400).send({ error: 'Batch validation failed', details: allErrors });
        }

        // 2. Generate QRs
        const qrBase64Array = [];
        for (let i = 0; i < nalogi.length; i++) {
            qrBase64Array.push(await QrGenerator.generateImage(nalogi[i], { format: 'png' }));
        }

        // 3. Output logic
        if (merge !== false) {
            // MERGE = TRUE -> 1 PDF with multiple pages
            const pdfBytes = await PdfBuilder.generateBatchPdf(nalogi, { format: format || 'exact', qrBase64Array });
            
            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `attachment; filename="upn-nalogi-batch.pdf"`);
            return Buffer.from(pdfBytes);
        } else {
            // MERGE = FALSE -> ZIP with multiple PDFs
            const zip = new AdmZip();
            
            for (let i = 0; i < nalogi.length; i++) {
                const pdfBytes = await PdfBuilder.generateUpnPdf(nalogi[i], { format: format || 'exact', qrBase64: qrBase64Array[i] });
                // Use purpose or name as filename safely, otherwise fallback to index
                const safeName = (nalogi[i].payerName || `nalog-${i+1}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                zip.addFile(`${safeName}_${i+1}.pdf`, Buffer.from(pdfBytes));
            }

            const zipBuffer = zip.toBuffer();
            reply.header('Content-Type', 'application/zip');
            reply.header('Content-Disposition', `attachment; filename="upn-nalogi-batch.zip"`);
            return zipBuffer;
        }
    }
};
