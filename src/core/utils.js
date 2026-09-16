export const Utils = {
    // Odstrani nepodprte znake, pretvori šumnike
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
        // Zamenjamo znake po mapi, nato počistimo ostale nepredvidene znake
        let sanitized = str.replace(/[ČŠŽčšžĆĐćđÜÖÄẞüöäß–—´`„“"]/g, m => map[m] || '');
        
        // Standard UPN dovoljuje omejen nabor. Odstranimo vse, kar ni dovoljeno.
        // Posebej pomembno: odstranitev \n in \r, saj bi to zlomilo zgradbo QR vrstic!
        sanitized = sanitized.replace(/[^a-zA-Z0-9 \+\?\/\:\(\)\.\,\'\-]/g, '');
        return sanitized.trim();
    },

    // 15.5 -> "000000001550"
    formatAmountForQr(amountStr) {
        if (!amountStr) return '00000000000'; // 11 mest
        let floatVal = parseFloat(amountStr.toString().replace(',', '.'));
        if (isNaN(floatVal)) floatVal = 0;
        let cents = Math.round(floatVal * 100);
        return cents.toString().padStart(11, '0');
    },

    // "2026-04-07" -> "07.04.2026"
    formatDateForQr(val) {
        if (!val) return '';
        if (!val.includes('-')) return val;
        const p = val.split('-');
        return `${p[2]}.${p[1]}.${p[0]}`;
    },

    calculateQrChecksum(lines) {
        let total = 0;
        lines.forEach(line => {
            total += (line + '\n').length;
        });
        return total.toString().padStart(3, '0');
    },

    formatAmountForDisplay(amountStr) {
        if (!amountStr || amountStr.toString().trim() === '' || amountStr === '0') return '***0,00';
        let clean = amountStr.toString().replace(',', '.');
        let floatVal = parseFloat(clean);
        if (isNaN(floatVal)) return '***0,00';
        let formatted = floatVal.toFixed(2).replace('.', ',');
        return '***' + formatted;
    }
};
