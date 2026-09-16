/**
 * Validator Module — Mathematical validation for UPN references (SI/RF)
 * Standard: ZBS Standard (Modulo 11 & Modulo 97-10)
 */

export const Validator = {

    /**
     * Validates Slovenian SI reference 
     * Handles specific ZBS models: 00, 01, 02, 05, 11, 12, 18, 99
     * @param {string} fullRef - Full reference string, e.g., "SI0519-1235-845037"
     * @returns {boolean}
     */
    validateSI(fullRef) {
        if (!fullRef || !fullRef.startsWith('SI')) return false;

        // Normalize dashes
        const normalized = fullRef.replace(/[\u2013\u2014]/g, '-').toUpperCase();
        const model = normalized.substring(2, 4);
        const data = normalized.substring(4); // Keep hyphens for part-based validation
        const numericOnly = data.replace(/[^0-9]/g, '');

        if (model === '99') return numericOnly.length === 0;
        if (model === '00') return /^[\d-]{1,22}$/.test(data) && numericOnly.length > 0;

        // Mathematical validation based on model
        switch (model) {
            case '12':
                // Strict rule: 13 digits total
                if (numericOnly.length !== 13) return false;
                return this._checkMod11(numericOnly);

            case '05':
                // Modulo 97-10 (ISO 7064)
                if (numericOnly.length < 3 || numericOnly.length > 20) return false;
                return this._checkMod97(numericOnly);

            case '11':
                // Multi-part Modulo 11: P1-P2-P3
                // P1 and P2 MUST have their own check digits (last digit of each part)
                const p11 = data.split('-').filter(p => p.length > 0);
                if (p11.length < 2) return false; // Needs at least 2 parts
                
                // Validate P1
                if (!this._checkMod11(p11[0])) return false;
                // Validate P2
                if (!this._checkMod11(p11[1])) return false;
                return true;

            case '18':
                // Three-part Modulo 11
                const p18 = data.split('-').filter(p => p.length > 0);
                if (p18.length < 3) return false;
                if (!this._checkMod11(p18[0])) return false;
                if (!this._checkMod11(p18[1])) return false;
                if (!this._checkMod11(p18[2])) return false;
                return true;

            case '01':
            case '02':
                // Single Modulo 11 check on the entire numeric string
                return this._checkMod11(numericOnly);

            default:
                // Fallback for SI06-SI10, SI13-SI19 etc.
                // Generally these follow Modulo 11 on the whole string unless otherwise specified
                if (numericOnly.length < 2) return false;
                return this._checkMod11(numericOnly);
        }
    },

    /**
     * Validates ISO 11649 RF reference (Modulo 97-10)
     */
    validateRF(fullRef) {
        if (!fullRef || !fullRef.startsWith('RF')) return false;
        
        const cleanRef = fullRef.replace(/[\s\u2013\u2014\-]/g, '').toUpperCase();
        if (cleanRef.length < 5 || cleanRef.length > 25) return false;

        const shifted = cleanRef.substring(4) + cleanRef.substring(0, 4);
        const numericStr = this._stringToNumeric(shifted);
        if (!numericStr) return false;

        try {
            return BigInt(numericStr) % 97n === 1n;
        } catch (e) {
            return false;
        }
    },

    /**
     * Internal Modulo 11 check (ZBS Variant)
     * Last digit is K
     */
    _checkMod11(s) {
        const clean = s.replace(/\D/g, '');
        if (clean.length < 2) return false;
        
        const data = clean.substring(0, clean.length - 1);
        const K = parseInt(clean.substring(clean.length - 1));
        
        return K === this.calculateMod11(data);
    },

    /**
     * Internal Modulo 97-10 check (ISO 7064)
     * Last two digits are control
     */
    _checkMod97(s) {
        const clean = s.replace(/\D/g, '');
        if (clean.length < 3) return false;
        
        try {
            return BigInt(clean) % 97n === 1n;
        } catch (e) {
            return false;
        }
    },

    /**
     * Calculates Modulo 11 Check Digit (ZBS Rule)
     */
    calculateMod11(data) {
        const s = data.toString().replace(/[^0-9]/g, '');
        let sum = 0;
        let weight = 2;

        for (let i = s.length - 1; i >= 0; i--) {
            sum += parseInt(s[i]) * weight;
            weight++;
            if (weight > 13) weight = 2; // ZBS weights cycle 2...13
        }

        const remainder = sum % 11;
        if (remainder === 0 || remainder === 1) return 0;
        return 11 - remainder;
    },

    /**
     * Calculates ISO 7064 Modulo 97-10 check digits
     * @param {string} data - Numeric string
     * @returns {string} Two digits
     */
    calculateMod97(data) {
        const clean = data.toString().replace(/[^0-9]/g, '');
        if (clean.length === 0) return '00';
        
        // Algorithm: 98 - (data * 100) % 97
        const remainder = BigInt(clean + "00") % 97n;
        const diff = 98n - remainder;
        
        return diff.toString().padStart(2, '0');
    },

    /**
     * Calculates ISO 11649 RF Check Digits
     */
    calculateRFCheckDigits(rawContent) {
        const clean = rawContent.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const prep = clean + "RF00";
        const numericStr = this._stringToNumeric(prep);
        
        const remainder = BigInt(numericStr) % 97n;
        const diff = 98n - remainder;
        
        return diff.toString().padStart(2, '0');
    },

    /**
     * Converts letters in string to numbers (A=10, ..., Z=35)
     */
    _stringToNumeric(s) {
        let res = '';
        for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            if (code >= 65 && code <= 90) { // A-Z
                res += (code - 55).toString();
            } else if (code >= 48 && code <= 57) { // 0-9
                res += s[i];
            } else {
                return null;
            }
        }
        return res;
    },

    /**
     * Validates IBAN
     */
    validateIBAN(iban) {
        if (!iban) return false;
        const clean = iban.replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{2}\d{2}[A-Z\d]{4,30}$/.test(clean)) return false;

        const country = clean.substring(0, 2);
        const lengths = { 'SI': 19, 'AT': 20, 'BE': 16, 'HR': 21, 'DE': 22, 'IT': 27, 'CH': 21, 'RS': 22 };
        if (lengths[country] && clean.length !== lengths[country]) return false;

        const shifted = clean.substring(4) + clean.substring(0, 4);
        const numericStr = this._stringToNumeric(shifted);
        if (!numericStr) return false;

        try {
            return BigInt(numericStr) % 97n === 1n;
        } catch (e) {
            return false;
        }
    },

    /**
     * Validates the form based on current state.
     */
    validateForm(store) {
        const errors = [];
        const warnings = [];
        let m = 'placilo';
        if (store.polog) m = 'polog';
        else if (store.dvig) m = 'dvig';
        else if (store.humanitarno) m = 'humanitarno';

        const req = (field, msg) => { if (!store[field] || store[field].toString().trim() === '') errors.push({ field, msg }); };
        const forbid = (field, msg) => { if (store[field] && store[field].toString().trim() !== '') { if (typeof store[field] === 'boolean' && store[field] === false) return; errors.push({ field, msg }); } };
        const warn = (field, msg) => { if (!store[field] || store[field].toString().trim() === '') warnings.push({ field, msg }); };

        if (m !== 'humanitarno') req('amount', 'Znesek je obvezen.');
        if (m === 'placilo' || m === 'dvig') req('payerName', 'Plačnik je obvezen.');
        if (store.polog && store.dvig) errors.push({ field: 'dvig', msg: 'Polog in Dvig se izključujeta.' });

        // ZBS: Znesek mora biti pozitiven in ne sme presegati 999.999.999,99 (11-mestni cents format)
        if (store.amount) {
            const amt = parseFloat(store.amount.toString().replace(',', '.'));
            if (!isNaN(amt)) {
                if (amt < 0) errors.push({ field: 'amount', msg: 'Znesek ne sme biti negativen.' });
                if (amt > 999999999.99) errors.push({ field: 'amount', msg: 'Znesek presega maksimalno dovoljeno vrednost (999.999.999,99).' });
            }
        }
        
        if (m === 'polog' || m === 'dvig') {
            req('paymentDate', 'Datum plačila je obvezen.');
            forbid('dueDate', 'Rok plačila ni dovoljen pri pologu/dvigu.');
        } else if (m === 'humanitarno') {
            forbid('paymentDate', 'Datum ni dovoljen pri humanitarnem nalogu.');
            if (!store.recipientRefCode || !store.recipientRef) {
                errors.push({ field: 'recipientRef', msg: 'Referenca prejemnika (model in sklic) je obvezna za humanitarni nalog.' });
            }
        }

        if (m === 'dvig') req('payerIban', 'IBAN plačnika je obvezen.');
        if (m === 'humanitarno' || m === 'polog') forbid('payerIban', 'IBAN plačnika ni dovoljen.');
        
        if (store.payerIban && !this.validateIBAN(store.payerIban)) errors.push({ field: 'payerIban', msg: 'Neveljaven IBAN plačnika.' });
        
        if (m === 'dvig') forbid('recipientIban', 'IBAN prejemnika ni dovoljen pri dvigu.');
        else {
            req('recipientIban', 'IBAN prejemnika je obvezen.');
            req('recipientName', 'Ime prejemnika je obvezno.');
        }
        
        if (store.recipientIban && !this.validateIBAN(store.recipientIban)) errors.push({ field: 'recipientIban', msg: 'Neveljaven IBAN prejemnika.' });

        // Rule 2.1: JFP (Uprava RS za javna plačila)
        if (m === 'placilo' && (store.recipientIban || '').replace(/\s/g, '').startsWith('SI5601')) {
            if (!store.recipientRefCode || !store.recipientRef) {
                errors.push({ field: 'recipientRef', msg: 'Referenca (model in sklic) je strogo obvezna za JFP (SI56 01...).' });
            }
        }

        req('purposeCode', 'Koda namena je obvezna.');
        req('purpose', 'Namen plačila je obvezen.');

        const checkRef = (codeF, refF, name) => {
            const code = store[codeF] || '';
            const val = store[refF] || '';
            if (!code && !val) return;
            
            if (code && !val && code !== 'SI99') {
                errors.push({ field: refF, msg: `Manjka vsebina sklica za model ${code} (${name}).` });
                return;
            }
            if (!code && val) {
                errors.push({ field: codeF, msg: `Izberite model (npr. SI00) za vnesen sklic (${name}).` });
                return;
            }

            const full = code.toUpperCase() + val.toUpperCase();
            if (full.startsWith('SI')) {
                if (!this.validateSI(full)) errors.push({ field: refF, msg: `Neveljavna SI referenca (${name}). Napačna kontrolna številka.` });
            } else if (full.startsWith('RF')) {
                if (!this.validateRF(full)) errors.push({ field: refF, msg: `Neveljavna RF referenca (${name}). Napačna kontrolna številka.` });
            }
        };

        checkRef('payerRefCode', 'payerRef', 'plačnika');
        checkRef('recipientRefCode', 'recipientRef', 'prejemnika');

        // Dodajanje opozoril
        if (m === 'placilo' || m === 'dvig') {
            warn('payerAddress', 'Priporočljiv je naslov plačnika.');
            warn('payerPlace', 'Priporočljiv je kraj plačnika.');
        }
        if (m !== 'dvig') {
            warn('recipientAddress', 'Priporočljiv je naslov prejemnika.');
            warn('recipientPlace', 'Priporočljiv je kraj prejemnika.');
        }
        if (m === 'placilo') {
            warn('dueDate', 'Priporočljiv je rok plačila.');
        }

        return { errors, warnings };
    }
};
