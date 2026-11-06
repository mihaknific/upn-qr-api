const MAX_ITEMS = 500;
const BOOLEAN_FIELDS = new Set(['urgent', 'nujno', 'polog', 'dvig', 'humanitarno']);
const ALLOWED_FIELDS = new Set([
    'amount',
    'payerName',
    'payerAddress',
    'payerCity',
    'payerPlace',
    'payerIban',
    'payerRefCode',
    'payerRef',
    'recipientName',
    'recipientAddress',
    'recipientCity',
    'recipientPlace',
    'recipientIban',
    'recipientRefCode',
    'recipientRef',
    'purposeCode',
    'purpose',
    'paymentDate',
    'dueDate',
    'urgent',
    'nujno',
    'polog',
    'dvig',
    'humanitarno',
    'mode',
    'currency',
    'epcBic',
    'epcInformation'
]);

function detectDelimiter(text) {
    let quoted = false;
    let commas = 0;
    let semicolons = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') {
                i++;
            } else {
                quoted = !quoted;
            }
        } else if (!quoted && (char === '\r' || char === '\n')) {
            break;
        } else if (!quoted && char === ',') {
            commas++;
        } else if (!quoted && char === ';') {
            semicolons++;
        }
    }

    return semicolons > commas ? ';' : ',';
}

function parseRecords(text, delimiter) {
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;
    let closedQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (quoted) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
                closedQuote = true;
            } else {
                field += char;
            }
            continue;
        }

        if (closedQuote && char !== delimiter && char !== '\r' && char !== '\n') {
            throw new Error('CSV vsebuje besedilo za zaključnim narekovajem.');
        }

        if (char === delimiter) {
            record.push(field);
            field = '';
            closedQuote = false;
        } else if (char === '\r' || char === '\n') {
            record.push(field);
            if (record.some(value => value.trim() !== '')) records.push(record);
            record = [];
            field = '';
            closedQuote = false;
            if (char === '\r' && text[i + 1] === '\n') i++;
        } else if (char === '"') {
            if (field !== '') throw new Error('CSV vsebuje narekovaj na neveljavnem mestu.');
            quoted = true;
        } else {
            field += char;
        }
    }

    if (quoted) throw new Error('CSV vsebuje nedokončano polje v narekovajih.');
    record.push(field);
    if (record.some(value => value.trim() !== '')) records.push(record);
    return records;
}

export function parseCsvBatch(input) {
    if (typeof input !== 'string' || !input.trim()) {
        throw new Error('CSV datoteka je prazna.');
    }

    const text = input.replace(/^\uFEFF/, '');
    const records = parseRecords(text, detectDelimiter(text));
    if (records.length < 2) {
        throw new Error('CSV mora vsebovati glavo stolpcev in vsaj eno vrstico naloga.');
    }

    const headers = records[0].map(value => value.trim());
    if (headers.some(header => !header)) throw new Error('CSV glava vsebuje prazen naziv stolpca.');
    if (new Set(headers).size !== headers.length) throw new Error('CSV glava vsebuje podvojen naziv stolpca.');

    const unknownHeaders = headers.filter(header => !ALLOWED_FIELDS.has(header));
    if (unknownHeaders.length) {
        throw new Error(`Neznani CSV stolpci: ${unknownHeaders.join(', ')}.`);
    }

    const dataRows = records.slice(1);
    if (dataRows.length > MAX_ITEMS) {
        throw new Error(`CSV lahko vsebuje največ ${MAX_ITEMS} nalogov.`);
    }

    return dataRows.map((values, index) => {
        if (values.length !== headers.length) {
            throw new Error(`CSV vrstica ${index + 2} ima ${values.length} vrednosti, pričakovanih pa je ${headers.length}.`);
        }

        const item = Object.fromEntries(headers.map((header, column) => [
            header,
            values[column].trim()
        ]));

        for (const field of BOOLEAN_FIELDS) {
            if (!Object.hasOwn(item, field)) continue;
            const value = item[field].toLowerCase();
            if (!value) {
                delete item[field];
            } else if (['true', '1', 'da'].includes(value)) {
                item[field] = true;
            } else if (['false', '0', 'ne'].includes(value)) {
                item[field] = false;
            } else {
                throw new Error(`CSV vrstica ${index + 2}: stolpec ${field} mora biti true/false ali da/ne.`);
            }
        }

        return item;
    });
}

export function parseJsonBatch(input) {
    let value;
    try {
        value = JSON.parse(input);
    } catch (error) {
        throw new Error(`JSON ni veljaven: ${error.message}`);
    }

    const items = Array.isArray(value) ? value : (value?.nalogi || [value]);
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('JSON mora vsebovati vsaj en UPN nalog.');
    }
    if (items.length > MAX_ITEMS) {
        throw new Error(`JSON lahko vsebuje največ ${MAX_ITEMS} nalogov.`);
    }
    if (items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw new Error('Vsak JSON nalog mora biti objekt s polji UPN.');
    }
    for (const [index, item] of items.entries()) {
        const unknownFields = Object.keys(item).filter(field => !ALLOWED_FIELDS.has(field));
        if (unknownFields.length) {
            throw new Error(`JSON nalog ${index + 1} vsebuje neznana polja: ${unknownFields.join(', ')}.`);
        }
    }

    return items;
}
