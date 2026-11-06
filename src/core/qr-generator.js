import QRCode from 'qrcode';
import { Utils } from './utils.js';
import { Validator } from './validator.js';

const MAX_NAME_LENGTH = 70;
const MAX_REMITTANCE_LENGTH = 140;
const MAX_INFORMATION_LENGTH = 70;
const BIC_PATTERN = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;

export const QrGenerator = {
    /**
     * Generates the ZBS Standard UPNQR string (20 fields).
     * @param {Object} data - UPN data.
     * @returns {string} The formatted UPNQR string.
     */
    generatePayload(data) {
        const _textField = (value, label, limit) => {
            const text = (value || '').trim();
            if (Utils.hasUnsupportedQrChars(text) || Utils.hasLossyQrText(text)) {
                throw new Error(`${label} vsebuje znake, ki niso podprti v ISO-8859-2.`);
            }
            const byteLength = Utils.encodeIso88592(text).length;
            if (byteLength > limit) {
                throw new Error(`${label} je predolgo za UPN QR (${byteLength}/${limit} znakov).`);
            }
            return text;
        };

        const payerCity = data.payerCity || data.payerPlace || '';
        const recipientCity = data.recipientCity || data.recipientPlace || '';
        const isUrgent = data.nujno !== undefined ? data.nujno : (data.urgent !== undefined ? data.urgent : false);
        const isPolog = data.mode === 'polog' || data.polog;
        const isDvig = data.mode === 'dvig' || data.dvig;

        const lines = [
            'UPNQR',                                                          // 1. Vodilni slog
            (data.payerIban || '').replace(/\s/g, '').toUpperCase(),          // 2. IBAN plačnika
            isPolog ? 'X' : '',                                               // 3. Polog
            isDvig ? 'X' : '',                                                // 4. Dvig
            Utils.formatReferenceForQr(data.payerRefCode, data.payerRef),      // 5. Referenca plačnika
            _textField(data.payerName, 'Ime plačnika', 33),                   // 6. Ime plačnika
            _textField(data.payerAddress, 'Ulica plačnika', 33),              // 7. Ulica plačnika
            _textField(payerCity, 'Kraj plačnika', 33),                       // 8. Kraj plačnika
            Utils.formatAmountForQr(data.amount),                             // 9. Znesek (11 digits)
            Utils.formatDateForQr(data.paymentDate),                          // 10. Datum plačila
            isUrgent ? 'X' : '',                                              // 11. Nujno
            (data.purposeCode || 'OTHR').toUpperCase().substring(0, 4),       // 12. Koda namena
            _textField(data.purpose, 'Namen plačila', 42),                    // 13. Namen plačila
            Utils.formatDateForQr(data.dueDate),                              // 14. Rok plačila
            (data.recipientIban || '').replace(/\s/g, '').toUpperCase(),      // 15. IBAN prejemnika
            Utils.formatReferenceForQr(data.recipientRefCode, data.recipientRef), // 16. Referenca prejemnika
            _textField(data.recipientName, 'Ime prejemnika', 33),             // 17. Ime prejemnika
            _textField(data.recipientAddress, 'Ulica prejemnika', 33),        // 18. Ulica prejemnika
            _textField(recipientCity, 'Kraj prejemnika', 33)                  // 19. Kraj prejemnika
        ];

        const checksum = Utils.calculateQrChecksum(lines);
        lines.push(checksum);

        const zbsString = lines.join('\n') + '\n';
        const payloadBytes = Utils.encodeIso88592(zbsString, true);
        if (payloadBytes.length > 411) {
            throw new Error(`QR ni veljaven: prevelika vsebina (${payloadBytes.length}/411 bajtov).`);
        }

        return zbsString;
    },

    /**
     * Generates SEPA EPC QR Payload (version 002 SCT)
     */
    generateEpcPayload(data) {
        const cleanText = (val, label, limit) => {
            const res = (val || '').trim();
            if (/[\u0000-\u001F\u007F]/.test(res)) {
                throw new Error(`${label} ne sme vsebovati kontrolnih znakov.`);
            }
            if ([...res].length > limit) {
                throw new Error(`${label} je predolgo (${[...res].length}/${limit} znakov).`);
            }
            return res;
        };

        const name = cleanText(data.recipientName, 'Ime prejemnika', MAX_NAME_LENGTH);
        if (!name) throw new Error('Vnesite ime prejemnika za EPC QR.');

        const iban = (data.recipientIban || '').replace(/\s/g, '').toUpperCase();
        if (!iban || !Validator.validateSepaIBAN(iban)) {
            throw new Error('Za EPC QR vnesite veljaven SEPA IBAN prejemnika.');
        }

        const bic = (data.epcBic || '').replace(/\s/g, '').toUpperCase();
        if (bic && !BIC_PATTERN.test(bic)) {
            throw new Error('BIC mora imeti 8 ali 11 veljavnih znakov.');
        }

        const purposeCode = cleanText(data.purposeCode, 'Koda namena', 4).toUpperCase();
        if (purposeCode && !/^[A-Z0-9]{4}$/.test(purposeCode)) {
            throw new Error('Koda namena EPC QR mora vsebovati natanko 4 črke ali številke.');
        }

        let amountStr = '';
        if (data.amount !== undefined && data.amount !== null && data.amount !== '') {
            const raw = data.amount.toString().trim().replace(',', '.');
            const num = Number(raw);
            if (num > 0) amountStr = `EUR${num.toFixed(2)}`;
        }

        const remittance = cleanText(data.purpose, 'Opis plačila', MAX_REMITTANCE_LENGTH);
        const information = cleanText(data.epcInformation, 'Dodatne informacije', MAX_INFORMATION_LENGTH);

        const lines = [
            'BCD',
            '002',
            '1',
            'SCT',
            bic,
            name,
            iban,
            amountStr,
            purposeCode,
            remittance,
            information
        ];

        const payload = `${lines.join('\n')}\n`;
        const byteLen = new TextEncoder().encode(payload).length;
        if (byteLen > 331) {
            throw new Error(`EPC QR je predolg (${byteLen}/331 bajtov).`);
        }
        return payload;
    },

    /**
     * Generates a QR code image as base64 string or SVG string.
     * @param {Object} data - UPN data.
     * @param {Object} options - { format: 'png' | 'svg', type: 'upn' | 'epc' }
     * @returns {Promise<string>}
     */
    async generateImage(data, options = { format: 'png', type: 'upn' }) {
        if (options.type === 'epc') {
            const payload = this.generateEpcPayload(data);
            const qrOptions = {
                errorCorrectionLevel: 'M',
                margin: 4,
                color: { dark: '#000000', light: '#ffffff' }
            };
            if (options.format === 'svg') {
                return await QRCode.toString(payload, { ...qrOptions, type: 'svg' });
            }
            return await QRCode.toDataURL(payload, qrOptions);
        }

        // Standard UPN QR with ECI 4 (ISO-8859-2)
        const payloadString = this.generatePayload(data);
        const payloadBytes = Utils.encodeIso88592(payloadString, true);

        // Segment with ECI 4
        // QRCode supports segments array
        const segments = [
            { data: 4, mode: 'eci' }, // ECI 4 = ISO-8859-2
            { data: payloadBytes, mode: 'byte' }
        ];

        const qrOptions = {
            errorCorrectionLevel: 'M',
            version: 15, // Fixed ZBS standard version 15
            margin: 0,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        };

        if (options.format === 'svg') {
            qrOptions.type = 'svg';
            return await QRCode.toString(segments, qrOptions);
        } else {
            return await QRCode.toDataURL(segments, qrOptions);
        }
    }
};
