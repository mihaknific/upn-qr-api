let iso88592CharacterBytes;

function getIso88592CharacterBytes() {
    if (!iso88592CharacterBytes) {
        const decoder = new TextDecoder('iso-8859-2');
        iso88592CharacterBytes = new Map();
        for (let byte = 0; byte <= 0xFF; byte++) {
            const character = decoder.decode(Uint8Array.of(byte));
            if (character !== '\uFFFD') iso88592CharacterBytes.set(character, byte);
        }
    }
    return iso88592CharacterBytes;
}

export const Utils = {
    /**
     * Enkodira niz v ISO-8859-2 zbirko bajtov (za ZBS UPN QR).
     * @param {string} str
     * @param {boolean} allowLineFeed
     * @returns {Uint8Array}
     */
    encodeIso88592(str, allowLineFeed = false) {
        const characterBytes = getIso88592CharacterBytes();
        const bytes = [];
        for (const character of str) {
            const byte = characterBytes.get(character);
            if (byte === undefined || (byte < 0x20 && !(allowLineFeed && byte === 0x0A)) || byte === 0x7F) {
                throw new Error(`Besedilo vsebuje znak (${character}), ki ni podprt v ISO-8859-2.`);
            }
            bytes.push(byte);
        }
        return Uint8Array.from(bytes);
    },

    /**
     * Preveri, če niz vsebuje znake, ki niso podprti v ISO-8859-2.
     */
    hasUnsupportedQrChars(str) {
        if (!str) return false;
        try {
            this.encodeIso88592(str.trim());
            return false;
        } catch {
            return true;
        }
    },

    /**
     * Preveri izgubo znakov ob pretvorbi.
     */
    hasLossyQrText(str) {
        if (!str) return false;
        if (str !== str.trim()) return true;
        try {
            const bytes = this.encodeIso88592(str);
            return new TextDecoder('iso-8859-2').decode(bytes) !== str;
        } catch {
            return true;
        }
    },

    /**
     * Sanitizacija za vizualni prikaz ali fallback (če je potreben).
     */
    sanitizeForQr(str) {
        if (!str) return '';
        const map = {
            'Č': 'C', 'Š': 'S', 'Ž': 'Z',
            'č': 'c', 'š': 's', 'ž': 'z',
            'Ć': 'C', 'Đ': 'D', 'ć': 'c', 'đ': 'd',
            'Ü': 'U', 'Ö': 'O', 'Ä': 'A', 'ẞ': 'SS',
            'ü': 'u', 'ö': 'o', 'ä': 'a', 'ß': 'ss',
            '–': '-', '—': '-', '´': "'", '`': "'", '"': "'", '„': "'", '“': "'"
        };
        let sanitized = str.replace(/[ČŠŽčšžĆĐćđÜÖÄẞüöäß–—´`„“"]/g, m => map[m] || '');
        sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return sanitized.replace(/[^\x20-\x7E]/g, '').trim();
    },

    // 15.5 -> "00000001550" (11 mest v centih po ZBS)
    formatAmountForQr(amountStr) {
        if (amountStr === undefined || amountStr === null || amountStr === '') return '00000000000'; // 11 mest
        let floatVal = parseFloat(amountStr.toString().replace(',', '.'));
        if (isNaN(floatVal)) floatVal = 0;
        let cents = Math.max(0, Math.round(floatVal * 100));
        return cents.toString().padStart(11, '0');
    },

    formatDateForQr(val) {
        if (!val) return '';
        if (!val.includes('-')) return val;
        const p = val.split('-');
        return `${p[2]}.${p[1]}.${p[0]}`;
    },

    formatReferenceForQr(model, reference) {
        const code = (model || '').trim().toUpperCase();
        let value = (reference || '').replace(/\s/g, '').toUpperCase();
        if (code === 'RF') value = value.replace(/-/g, '');
        return code + value;
    },

    calculateQrChecksum(lines) {
        let total = 0;
        lines.forEach(line => {
            total += this.encodeIso88592(line + '\n', true).length;
        });
        return total.toString().padStart(3, '0');
    },

    // Prikaz zneska na obrazcu s tremi zvezdicami (npr. 15.50 -> "***15,50")
    formatAmountForDisplay(amountStr) {
        if (!amountStr || amountStr.toString().trim() === '' || amountStr === '0') return '***0,00';
        let clean = amountStr.toString().replace(',', '.');
        let floatVal = parseFloat(clean);
        if (isNaN(floatVal)) return '***0,00';
        let formatted = floatVal.toFixed(2).replace('.', ',');
        return '***' + formatted;
    }
};
