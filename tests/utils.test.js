import { Utils } from '../src/core/utils.js';
import assert from 'assert';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  OK: ${name}`);
    } catch (e) {
        failed++;
        console.error(`  NAPAKA: ${name}`);
        console.error(`     ${e.message}`);
    }
}

console.log('\n═══════════════════════════════════════');
console.log('  Utils Tests');
console.log('═══════════════════════════════════════\n');
// ─── encodeIso88592 ──────────────────────────────────────────────────────────

console.log('── encodeIso88592 ──');

test('ASCII niz: pravilna dolzina', () => {
    const bytes = Utils.encodeIso88592('ABCDEFG');
    assert.strictEqual(bytes.length, 7);
});

test('Prazen niz: prazen rezultat', () => {
    const bytes = Utils.encodeIso88592('');
    assert.strictEqual(bytes.length, 0);
});

test('Sumniki (čšž): veljavni ISO-8859-2 znaki', () => {
    const bytes = Utils.encodeIso88592('čšž');
    assert.strictEqual(bytes.length, 3);
    // č = 0xE8, š = 0xB9, ž = 0xBE v ISO-8859-2
    assert.strictEqual(bytes[0], 0xE8);
    assert.strictEqual(bytes[1], 0xB9);
    assert.strictEqual(bytes[2], 0xBE);
});

test('Velike sumniki (ČŠŽ): veljavni ISO-8859-2 znaki', () => {
    const bytes = Utils.encodeIso88592('ČŠŽ');
    assert.strictEqual(bytes.length, 3);
    // Č = 0xC8, Š = 0xA9, Ž = 0xAE
    assert.strictEqual(bytes[0], 0xC8);
    assert.strictEqual(bytes[1], 0xA9);
    assert.strictEqual(bytes[2], 0xAE);
});

test('Emoji: vrze napako', () => {
    assert.throws(() => Utils.encodeIso88592('\u{1F642}'), /ni podprt/);
});

test('Kitajski znaki: vrze napako', () => {
    assert.throws(() => Utils.encodeIso88592('你好'), /ni podprt/);
});

test('Line feed dovoljen z allowLineFeed=true', () => {
    const bytes = Utils.encodeIso88592('A\nB', true);
    assert.strictEqual(bytes.length, 3);
    assert.strictEqual(bytes[1], 0x0A);
});

test('Line feed NI dovoljen z allowLineFeed=false', () => {
    assert.throws(() => Utils.encodeIso88592('A\nB', false), /ni podprt/);
});

test('Kontrolni znaki: vrze napako', () => {
    assert.throws(() => Utils.encodeIso88592('\x01'), /ni podprt/);
});

// ─── hasUnsupportedQrChars ────────────────────────────────────────────────────

console.log('\n── hasUnsupportedQrChars ──');

test('ASCII tekst: ni nepodprtih znakov', () => {
    assert.strictEqual(Utils.hasUnsupportedQrChars('JANEZ NOVAK'), false);
});

test('Sumniki: podprti', () => {
    assert.strictEqual(Utils.hasUnsupportedQrChars('ČŠŽČŠŽ'), false);
});

test('Emoji: nepodprt', () => {
    assert.strictEqual(Utils.hasUnsupportedQrChars(`Test \u{1F642}`), true);
});

test('Null: ni nepodprtih', () => {
    assert.strictEqual(Utils.hasUnsupportedQrChars(null), false);
});

test('Prazen niz: ni nepodprtih', () => {
    assert.strictEqual(Utils.hasUnsupportedQrChars(''), false);
});

// ─── hasLossyQrText ──────────────────────────────────────────────────────────

console.log('\n── hasLossyQrText ──');

test('Navaden tekst: ni izguben', () => {
    assert.strictEqual(Utils.hasLossyQrText('JANEZ NOVAK'), false);
});

test('Tekst s presledkom na zacetku: izguben (trim)', () => {
    assert.strictEqual(Utils.hasLossyQrText(' JANEZ'), true);
});

test('Tekst s presledkom na koncu: izguben (trim)', () => {
    assert.strictEqual(Utils.hasLossyQrText('JANEZ '), true);
});

test('Null: ni izguben', () => {
    assert.strictEqual(Utils.hasLossyQrText(null), false);
});

// ─── formatAmountForQr ────────────────────────────────────────────────────────

console.log('\n── formatAmountForQr ──');

test('Normalen znesek 15.50: 00000001550', () => {
    assert.strictEqual(Utils.formatAmountForQr('15.50'), '00000001550');
});

test('Znesek 0: 00000000000', () => {
    assert.strictEqual(Utils.formatAmountForQr('0'), '00000000000');
});

test('Prazen znesek: 00000000000', () => {
    assert.strictEqual(Utils.formatAmountForQr(''), '00000000000');
});

test('Null znesek: 00000000000', () => {
    assert.strictEqual(Utils.formatAmountForQr(null), '00000000000');
});

test('Undefined znesek: 00000000000', () => {
    assert.strictEqual(Utils.formatAmountForQr(undefined), '00000000000');
});

test('Znesek z vejico 15,50: 00000001550', () => {
    assert.strictEqual(Utils.formatAmountForQr('15,50'), '00000001550');
});

test('Velik znesek 999999999.99: 99999999999', () => {
    assert.strictEqual(Utils.formatAmountForQr('999999999.99'), '99999999999');
});

test('Znesek 1.00: 00000000100', () => {
    assert.strictEqual(Utils.formatAmountForQr('1.00'), '00000000100');
});

test('Rezultat je vedno 11 mest', () => {
    const result = Utils.formatAmountForQr('150');
    assert.strictEqual(result.length, 11);
});

// ─── formatDateForQr ──────────────────────────────────────────────────────────

console.log('\n── formatDateForQr ──');

test('ISO datum: DD.MM.YYYY', () => {
    assert.strictEqual(Utils.formatDateForQr('2026-06-01'), '01.06.2026');
});

test('Prazen datum: prazen niz', () => {
    assert.strictEqual(Utils.formatDateForQr(''), '');
});

test('Null datum: prazen niz', () => {
    assert.strictEqual(Utils.formatDateForQr(null), '');
});

test('Undefined datum: prazen niz', () => {
    assert.strictEqual(Utils.formatDateForQr(undefined), '');
});

test('Ze oblikovan datum (brez pomisljaja): nespremenjen', () => {
    assert.strictEqual(Utils.formatDateForQr('01.06.2026'), '01.06.2026');
});

// ─── formatReferenceForQr ─────────────────────────────────────────────────────

console.log('\n── formatReferenceForQr ──');

test('SI00 + referenca: pravilno spojeno', () => {
    assert.strictEqual(Utils.formatReferenceForQr('SI00', '1234-5678'), 'SI001234-5678');
});

test('RF + referenca: pomisljaji odstranjeni', () => {
    assert.strictEqual(Utils.formatReferenceForQr('RF', '71-2348-231'), 'RF712348231');
});

test('Prazen model + prazna referenca: prazen niz', () => {
    assert.strictEqual(Utils.formatReferenceForQr('', ''), '');
});

test('SI99 + prazna vsebina: samo SI99', () => {
    assert.strictEqual(Utils.formatReferenceForQr('SI99', ''), 'SI99');
});

test('Male crke: pretvorba v velike', () => {
    assert.strictEqual(Utils.formatReferenceForQr('si00', '1234'), 'SI001234');
});

// ─── calculateQrChecksum ─────────────────────────────────────────────────────

console.log('\n── calculateQrChecksum ──');

test('Kontrolna vsota: 3-mestni niz', () => {
    const result = Utils.calculateQrChecksum(['UPNQR', '', '', '']);
    assert.strictEqual(result.length, 3);
    assert.ok(/^\d{3}$/.test(result), 'Mora biti 3-mestna stevilka');
});

test('Kontrolna vsota: vecja za daljse vrstice', () => {
    const short = parseInt(Utils.calculateQrChecksum(['A']));
    const long = parseInt(Utils.calculateQrChecksum(['AAAAAAAAAAAA']));
    assert.ok(long > short, 'Vecji tekst -> vecja kontrolna vsota');
});

// ─── sanitizeForQr ───────────────────────────────────────────────────────────

console.log('\n── sanitizeForQr ──');

test('ASCII tekst: nespremenjen', () => {
    assert.strictEqual(Utils.sanitizeForQr('JANEZ NOVAK'), 'JANEZ NOVAK');
});

test('Sumniki: pretvorjeni v osnovne (Č->C, Š->S, Ž->Z)', () => {
    assert.strictEqual(Utils.sanitizeForQr('ČŠŽ'), 'CSZ');
    assert.strictEqual(Utils.sanitizeForQr('čšž'), 'csz');
});

test('Null: prazen niz', () => {
    assert.strictEqual(Utils.sanitizeForQr(null), '');
});

test('Prazen niz: prazen niz', () => {
    assert.strictEqual(Utils.sanitizeForQr(''), '');
});

test('Pomisljaj (em dash): pretvori v navaden -', () => {
    assert.strictEqual(Utils.sanitizeForQr('test—test'), 'test-test');
});

test('Nemski znaki: pretvorjeni (ü->u, ö->o, ä->a)', () => {
    assert.strictEqual(Utils.sanitizeForQr('Müller'), 'Muller');
});

// ─── formatAmountForDisplay ──────────────────────────────────────────────────

console.log('\n── formatAmountForDisplay ──');

test('Normalen znesek: ***15,50', () => {
    assert.strictEqual(Utils.formatAmountForDisplay('15.50'), '***15,50');
});

test('Prazen znesek: ***0,00', () => {
    assert.strictEqual(Utils.formatAmountForDisplay(''), '***0,00');
});

test('Null znesek: ***0,00', () => {
    assert.strictEqual(Utils.formatAmountForDisplay(null), '***0,00');
});

test('Znesek 0: ***0,00', () => {
    assert.strictEqual(Utils.formatAmountForDisplay('0'), '***0,00');
});

test('Velik znesek: ***999999999,99', () => {
    assert.strictEqual(Utils.formatAmountForDisplay('999999999.99'), '***999999999,99');
});

test('Znesek z vejico: ***150,00', () => {
    assert.strictEqual(Utils.formatAmountForDisplay('150,00'), '***150,00');
});

// ─── Povzetek ────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════');
if (failed > 0) {
    console.log(`  NAPAKA: ${failed}/${passed + failed} testov NEUSPEŠNIH!`);
    process.exit(1);
} else {
    console.log(`  OK: Vseh ${passed} Utils testov uspešno!`);
}
console.log('═══════════════════════════════════════\n');
