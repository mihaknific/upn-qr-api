import { Utils } from './utils.js';
import { PURPOSE_CODES } from './purpose-codes.js';

export const SI_MODELS = {
    '00': { minGroups: 1, maxGroups: 3, checks: [] },
    '01': { minGroups: 1, maxGroups: 3, checks: [[0, 1, 2]] },
    '02': { minGroups: 3, maxGroups: 3, checks: [[1], [2]] },
    '03': { minGroups: 3, maxGroups: 3, checks: [[0], [1], [2]] },
    '04': { minGroups: 3, maxGroups: 3, checks: [[0], [2]] },
    '05': { minGroups: 1, maxGroups: 3, checks: [[0]] },
    '06': { minGroups: 2, maxGroups: 3, checks: [[1, 2]] },
    '07': { minGroups: 2, maxGroups: 3, checks: [[1]] },
    '08': { minGroups: 3, maxGroups: 3, checks: [[0, 1], [2]] },
    '09': { minGroups: 1, maxGroups: 3, checks: [[0, 1]] },
    '10': { minGroups: 2, maxGroups: 3, checks: [[0], [1, 2]] },
    '11': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '12': { minGroups: 1, maxGroups: 1, checks: [[0]], fixedLength: 13 },
    '18': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '19': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '21': { minGroups: 2, maxGroups: 2, checks: [[0]] },
    '22': { minGroups: 2, maxGroups: 2, checks: [[0]], restricted: 'Samo za uporabo FURS.' },
    '23': { minGroups: 2, maxGroups: 2, checks: [[0], [1]] },
    '28': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '31': { minGroups: 2, maxGroups: 2, checks: [[0]] },
    '32': { minGroups: 2, maxGroups: 2, checks: [[0]], restricted: 'Samo za uporabo FURS.' },
    '38': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '40': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '41': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '48': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '49': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '51': { minGroups: 2, maxGroups: 3, checks: [[0], [1]] },
    '55': { minGroups: 1, maxGroups: 3, checks: [[0]] },
    '58': { minGroups: 2, maxGroups: 3, checks: [[0], [1]], restricted: 'Samo za upravljanje likvidnosti sistema enotnega zakladniškega računa.' },
    '99': { minGroups: 0, maxGroups: 0, checks: [] }
};

export const SEPA_IBAN_COUNTRIES = new Set(
    'AD AL AT BE BG CH CY CZ DE DK EE ES FI FO FR GB GG GI GL GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM VA'.split(' ')
);

/**
 * Validator Module — Mathematical validation for UPN references (SI/RF) & ZBS rules.
 */
export const Validator = {

    /**
     * Validates Slovenian SI reference
     */
    validateSI(fullRef) {
        if (!fullRef || !/^SI\d{2}/i.test(fullRef)) return false;

        const normalized = fullRef.replace(/\s/g, '').replace(/[\u2013\u2014]/g, '-').toUpperCase();
        const model = normalized.substring(2, 4);
        const spec = SI_MODELS[model];
        if (!spec) return false;

        const content = normalized.substring(4);
        if (model === '99') return content === '';
        if (!/^[0-9]+(?:-[0-9]+){0,2}$/.test(content)) return false;

        const groups = content.split('-');
        if (groups.length < spec.minGroups || groups.length > spec.maxGroups) return false;
        if (spec.fixedLength && groups[0].length !== spec.fixedLength) return false;
        if (groups.some(group => group.length > 12 && model !== '12')) return false;

        const checkedGroups = new Set(spec.checks.map(indexes => Math.min(indexes[indexes.length - 1], groups.length - 1)));
        for (let index = 1; index < groups.length; index++) {
            const part = checkedGroups.has(index) ? groups[index].slice(0, -1) : groups[index];
            if (part.length > 1 && part.startsWith('0')) return false;
        }

        const totalDigits = groups.reduce((total, group) => total + group.length, 0);
        if (totalDigits > 20 && model !== '12') return false;

        return spec.checks.every(indexes => {
            const checkedValue = indexes.map(index => groups[index] || '').join('');
            return this._checkMod11(checkedValue);
        });
    },

    /**
     * Validates ISO 11649 RF reference (Modulo 97-10)
     */
    validateRF(fullRef) {
        if (!fullRef || !/^RF/i.test(fullRef)) return false;
        
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
     */
    _checkMod11(s) {
        const clean = s.replace(/\D/g, '');
        if (clean.length < 2) return false;
        
        const data = clean.substring(0, clean.length - 1);
        const K = parseInt(clean.substring(clean.length - 1));
        
        const expected = this.calculateMod11(data);
        return K === expected;
    },

    calculateMod11(data) {
        const s = data.toString().replace(/[^0-9]/g, '');
        let sum = 0;
        let weight = 2;

        for (let i = s.length - 1; i >= 0; i--) {
            sum += parseInt(s[i]) * weight;
            weight++;
            if (weight > 13) weight = 2;
        }

        const remainder = sum % 11;
        if (remainder === 0 || remainder === 1) return 0;
        return 11 - remainder;
    },

    calculateRFCheckDigits(rawContent) {
        const clean = rawContent.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const prep = clean + "RF00";
        const numericStr = this._stringToNumeric(prep);
        
        const remainder = BigInt(numericStr) % 97n;
        const diff = 98n - remainder;
        
        return diff.toString().padStart(2, '0');
    },

    _stringToNumeric(s) {
        let res = '';
        for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            if (code >= 65 && code <= 90) {
                res += (code - 55).toString();
            } else if (code >= 48 && code <= 57) {
                res += s[i];
            } else {
                return null;
            }
        }
        return res;
    },

    validateIBAN(iban) {
        if (!iban) return false;
        const clean = iban.replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{2}\d{2}[A-Z\d]{4,30}$/.test(clean)) return false;

        const country = clean.substring(0, 2);
        const lengths = {
            AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22,
            BH: 22, BI: 27, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24,
            DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18,
            FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
            HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30,
            KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21,
            LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30,
            NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24,
            RS: 22, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27,
            SN: 28, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22,
            VG: 24, XK: 20
        };
        if (!lengths[country] || clean.length !== lengths[country]) return false;

        const shifted = clean.substring(4) + clean.substring(0, 4);
        const numericStr = this._stringToNumeric(shifted);
        if (!numericStr) return false;

        try {
            return BigInt(numericStr) % 97n === 1n;
        } catch (e) {
            return false;
        }
    },

    validateSepaIBAN(iban) {
        if (!this.validateIBAN(iban)) return false;
        const clean = iban.replace(/\s/g, '').toUpperCase();
        return SEPA_IBAN_COUNTRIES.has(clean.substring(0, 2));
    },

    /**
     * Validates form / request body.
     * Returns { errors, warnings }
     */
    validateForm(data = {}) {
        const errors = [];
        const warnings = [];

        // Normalize aliases: payerCity <-> payerPlace, recipientCity <-> recipientPlace, nujno <-> urgent
        const store = {
            ...data,
            payerCity: data.payerCity || data.payerPlace || '',
            recipientCity: data.recipientCity || data.recipientPlace || '',
            nujno: data.nujno !== undefined ? data.nujno : (data.urgent !== undefined ? data.urgent : false)
        };

        const supportedModes = ['placilo', 'humanitarno', 'polog', 'dvig'];
        const explicitMode = store.mode;
        if (explicitMode !== undefined && !supportedModes.includes(explicitMode)) {
            errors.push({ field: 'mode', msg: 'Način naloga ni podprt.' });
        }

        const activeModes = [
            store.polog && 'polog',
            store.dvig && 'dvig',
            store.humanitarno && 'humanitarno',
            explicitMode && explicitMode !== 'placilo' && supportedModes.includes(explicitMode) && explicitMode
        ].filter(Boolean);
        const uniqueModes = [...new Set(activeModes)];
        if (uniqueModes.length > 1 || (explicitMode === 'placilo' && activeModes.length > 0)) {
            errors.push({ field: 'mode', msg: 'Izberite samo en način naloga.' });
        }
        const m = supportedModes.includes(explicitMode)
            ? explicitMode
            : uniqueModes[0] || 'placilo';

        const req = (field, msg) => {
            if (store[field] === undefined || store[field] === null || store[field].toString().trim() === '') {
                errors.push({ field, msg });
            }
        };

        const forbid = (field, msg) => {
            const v = store[field];
            if (v && (typeof v !== 'string' || v.trim() !== '')) {
                errors.push({ field, msg });
            }
        };

        if (m !== 'humanitarno') req('amount', 'Znesek je obvezen.');
        if (m === 'placilo' || m === 'dvig') {
            req('payerName', 'Ime plačnika je obvezno.');
            req('payerAddress', 'Naslov plačnika je obvezen.');
            req('payerCity', 'Poštna številka in kraj plačnika sta obvezna.');
        }
        if (store.currency && store.currency !== 'EUR') {
            errors.push({ field: 'currency', msg: 'UPN QR podpira plačila v EUR.' });
        }

        if (store.amount !== undefined && store.amount !== null && store.amount.toString().trim() !== '') {
            const amountText = store.amount.toString().trim().replace(',', '.');
            if (/^-/.test(amountText)) {
                errors.push({ field: 'amount', msg: 'Znesek ne sme biti negativen.' });
            } else if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) {
                errors.push({ field: 'amount', msg: 'Vpišite znesek v EUR z največ dvema decimalnima mestoma.' });
            } else if (Number(amountText) > 999999999.99) {
                errors.push({ field: 'amount', msg: 'Znesek presega maksimalno dovoljeno vrednost (999.999.999,99).' });
            } else if (Number(amountText) === 0 && m !== 'humanitarno') {
                errors.push({ field: 'amount', msg: 'Znesek mora biti večji od nič.' });
            }
        }
        
        if (m === 'polog' || m === 'dvig') {
            req('paymentDate', 'Datum plačila je obvezen.');
            forbid('dueDate', 'Rok plačila ni dovoljen pri pologu/dvigu.');
            forbid('nujno', 'Nujno plačilo ni dovoljeno pri pologu ali dvigu.');
            if (m === 'polog') {
                forbid('payerRefCode', 'Referenca plačnika ni dovoljena pri pologu.');
                forbid('payerRef', 'Referenca plačnika ni dovoljena pri pologu.');
            }
        } else if (m === 'humanitarno') {
            forbid('paymentDate', 'Datum ni dovoljen pri humanitarnem nalogu.');
            forbid('payerRefCode', 'Referenca plačnika ni dovoljena pri humanitarnem nalogu.');
            forbid('payerRef', 'Referenca plačnika ni dovoljena pri humanitarnem nalogu.');
            forbid('nujno', 'Nujno plačilo ni dovoljeno pri humanitarnem nalogu.');
            if (!store.recipientRefCode || !store.recipientRef) {
                errors.push({ field: 'recipientRef', msg: 'Referenca prejemnika je pri humanitarnem nalogu obvezna.' });
            }
        }

        ['paymentDate', 'dueDate'].forEach(field => {
            const value = store[field];
            if (!value) return;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                errors.push({ field, msg: 'Datum mora biti v veljavni obliki (YYYY-MM-DD).' });
                return;
            }
            const [year, month, day] = value.split('-').map(Number);
            const parsed = new Date(Date.UTC(year, month - 1, day));
            if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
                errors.push({ field, msg: 'Vnesen datum ne obstaja.' });
            }
        });

        if (m === 'dvig') req('payerIban', 'IBAN plačnika je obvezen.');
        if (m === 'humanitarno' || m === 'polog') forbid('payerIban', 'IBAN plačnika ni dovoljen.');
        
        if (store.payerIban) {
            const payerIban = store.payerIban.replace(/\s/g, '').toUpperCase();
            if (!payerIban.startsWith('SI') || payerIban.length !== 19) {
                errors.push({ field: 'payerIban', msg: 'IBAN plačnika mora biti slovenski IBAN z 19 znaki.' });
            } else if (!this.validateIBAN(payerIban)) {
                errors.push({ field: 'payerIban', msg: 'Neveljaven IBAN plačnika.' });
            }
        }
        
        if (m === 'dvig') forbid('recipientIban', 'IBAN prejemnika ni dovoljen pri dvigu.');
        else {
            req('recipientIban', 'IBAN prejemnika je obvezen.');
            req('recipientName', 'Ime prejemnika je obvezno.');
            req('recipientAddress', 'Naslov prejemnika je obvezen.');
            req('recipientCity', 'Poštna številka in kraj prejemnika sta obvezna.');
        }
        
        if (store.recipientIban) {
            const recipientIban = store.recipientIban.replace(/\s/g, '').toUpperCase();
            if (!this.validateIBAN(recipientIban)) {
                errors.push({ field: 'recipientIban', msg: 'Neveljaven IBAN prejemnika.' });
            } else if (!SEPA_IBAN_COUNTRIES.has(recipientIban.substring(0, 2))) {
                errors.push({ field: 'recipientIban', msg: 'IBAN prejemnika mora biti iz območja SEPA.' });
            }
        }

        // JFP references mandatory for payments and cash deposits
        if (m !== 'dvig' && (store.recipientIban || '').replace(/\s/g, '').startsWith('SI5601')) {
            if (!store.recipientRefCode || !store.recipientRef) {
                errors.push({ field: 'recipientRef', msg: 'Referenca (model in sklic) je strogo obvezna za JFP (SI56 01...).' });
            }
        }

        req('purposeCode', 'Koda namena je obvezna.');
        req('purpose', 'Namen plačila je obvezen.');
        if (store.purposeCode && !PURPOSE_CODES.some(({ code }) => code === store.purposeCode.toUpperCase())) {
            errors.push({ field: 'purposeCode', msg: 'Izbrana koda namena ni na veljavnem šifrantu ZBS.' });
        }

        const qrTextFields = [
            ['payerName', 'Ime plačnika', 33],
            ['payerAddress', 'Naslov plačnika', 33],
            ['payerCity', 'Kraj plačnika', 33],
            ['purpose', 'Namen plačila', 42],
            ['recipientName', 'Ime prejemnika', 33],
            ['recipientAddress', 'Naslov prejemnika', 33],
            ['recipientCity', 'Kraj prejemnika', 33]
        ];

        qrTextFields.forEach(([field, label, limit]) => {
            const value = store[field] || '';
            if (Utils.hasUnsupportedQrChars(value) || Utils.hasLossyQrText(value)) {
                errors.push({ field, msg: `${label} vsebuje znake, ki niso podprti v ISO-8859-2 ali bi se v QR spremenili.` });
                return;
            }

            let encodedLength;
            try {
                encodedLength = Utils.encodeIso88592(value.trim()).length;
            } catch {
                return;
            }
            if (encodedLength > limit) {
                errors.push({ field, msg: `${label} je predolgo za UPN QR (${encodedLength}/${limit} znakov). Skrajšajte vnos.` });
            }
        });

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
                const model = code.substring(2);
                if (SI_MODELS[model]?.restricted) {
                    errors.push({ field: codeF, msg: `Model SI${model} je namenjen samo za posebno uporabo: ${SI_MODELS[model].restricted}` });
                    return;
                }
                if (!this.validateSI(full)) errors.push({ field: refF, msg: `Neveljavna SI referenca (${name}). Preverite model, obliko, dolžino in kontrolno številko.` });
            } else if (full.startsWith('RF')) {
                if (!this.validateRF(full)) errors.push({ field: refF, msg: `Neveljavna RF referenca (${name}). Napačna kontrolna številka.` });
            }
        };

        checkRef('payerRefCode', 'payerRef', 'plačnika');
        checkRef('recipientRefCode', 'recipientRef', 'prejemnika');

        return { errors, warnings };
    }
};
