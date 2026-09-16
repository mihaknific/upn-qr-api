import QRCode from 'qrcode';
import { Utils } from './utils.js';

export const QrGenerator = {
    /**
     * Generates the ZBS Standard UPNQR string (20 fields).
     * @param {Object} data - UPN data.
     * @returns {string} The formatted UPNQR string.
     */
    generatePayload(data) {
        const lines = [
            'UPNQR',                                                          // 1. Vodilni slog
            (data.payerIban || '').replace(/\s/g, '').toUpperCase(),          // 2. IBAN plačnika
            data.polog ? 'X' : '',                                            // 3. Polog
            data.dvig ? 'X' : '',                                             // 4. Dvig
            (data.payerRefCode || '') + (data.payerRef || ''),                // 5. Referenca plačnika
            Utils.sanitizeForQr(data.payerName).substring(0, 33),             // 6. Ime plačnika
            Utils.sanitizeForQr(data.payerAddress).substring(0, 33),          // 7. Ulica plačnika
            Utils.sanitizeForQr(data.payerPlace).substring(0, 33),            // 8. Kraj plačnika
            Utils.formatAmountForQr(data.amount),                             // 9. Znesek (11 digits)
            Utils.formatDateForQr(data.paymentDate),                          // 10. Datum plačila
            data.urgent ? 'X' : '',                                           // 11. Nujno
            (data.purposeCode || 'OTHR').toUpperCase().substring(0, 4),       // 12. Koda namena
            Utils.sanitizeForQr(data.purpose).substring(0, 42),               // 13. Namen plačila
            Utils.formatDateForQr(data.dueDate),                              // 14. Rok plačila
            (data.recipientIban || '').replace(/\s/g, '').toUpperCase(),      // 15. IBAN prejemnika
            (data.recipientRefCode || '') + (data.recipientRef || ''),        // 16. Referenca prejemnika
            Utils.sanitizeForQr(data.recipientName).substring(0, 33),         // 17. Ime prejemnika
            Utils.sanitizeForQr(data.recipientAddress).substring(0, 33),      // 18. Ulica prejemnika
            Utils.sanitizeForQr(data.recipientPlace).substring(0, 33)         // 19. Kraj prejemnika
        ];

        const checksum = Utils.calculateQrChecksum(lines);

        if (parseInt(checksum) > 999) {
            throw new Error(`QR vsebina je predolga (${checksum} bajtov > 999). Skrajšaj polja.`);
        }

        lines.push(checksum);
        return lines.join('\n') + '\n';
    },

    /**
     * Generates a QR code image as base64 string or SVG string.
     * @param {Object} data - UPN data.
     * @param {Object} options - { format: 'png' | 'svg' }
     * @returns {Promise<string>}
     */
    async generateImage(data, options = { format: 'png' }) {
        const payload = this.generatePayload(data);
        
        // ZBS standard specifies Version 15, ECC M, Byte mode, but qrcode handles mode automatically.
        // We will force 'errorCorrectionLevel': 'M', 'version': 15 if needed, but qrcode is usually smart enough.
        // Let's specify version 15 and errorCorrectionLevel M to perfectly match the standard.
        const qrOptions = {
            errorCorrectionLevel: 'M',
            version: 15,
            margin: 0,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        };

        if (options.format === 'svg') {
            qrOptions.type = 'svg';
            return await QRCode.toString(payload, qrOptions);
        } else {
            return await QRCode.toDataURL(payload, qrOptions);
        }
    }
};
