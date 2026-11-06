import { QrGenerator } from '../src/core/qr-generator.js';
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

async function asyncTest(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  OK: ${name}`);
    } catch (e) {
        failed++;
        console.error(`  NAPAKA: ${name}`);
        console.error(`     ${e.message}`);
    }
}

const dummyData = {
    payerName: 'JANEZ NOVAK',
    payerAddress: 'SLOVENSKA 1',
    payerPlace: '1000 LJUBLJANA',
    amount: '150.00',
    purposeCode: 'OTHR',
    purpose: 'TESTNO PLACILO Z ŠČŽ',
    paymentDate: '2026-06-01',
    recipientIban: 'SI56020170014356205',
    recipientRefCode: 'SI00',
    recipientRef: '1234',
    recipientName: 'PODJETJE D.O.O.',
    recipientAddress: 'ZOSENOVA 2',
    recipientPlace: '2000 MARIBOR',
};

async function runTests() {
    console.log('\n═══════════════════════════════════════');
    console.log('  QrGenerator Tests');
    console.log('═══════════════════════════════════════\n');

    // ─── UPN Payload ──────────────────────────────────────────────────────────

    console.log('── UPN Payload ──');

    test('Payload se zacne z UPNQR', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        assert.ok(payload.startsWith('UPNQR\n'));
    });

    test('Payload ima 21 vrstic (20 polj + zadnji newline)', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        assert.strictEqual(payload.split('\n').length, 21);
    });

    test('Payload: polje 9 je znesek v centih (11 mest)', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        const lines = payload.split('\n');
        assert.strictEqual(lines[8], '00000015000'); // 150.00 EUR = 15000 centov
    });

    test('Payload: polje 10 je datum v obliki DD.MM.YYYY', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        const lines = payload.split('\n');
        assert.strictEqual(lines[9], '01.06.2026');
    });

    test('Payload: polje 12 je koda namena', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        const lines = payload.split('\n');
        assert.strictEqual(lines[11], 'OTHR');
    });

    test('Payload: polje 15 je IBAN prejemnika', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        const lines = payload.split('\n');
        assert.strictEqual(lines[14], 'SI56020170014356205');
    });

    test('Payload: polje 16 je referenca prejemnika', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        const lines = payload.split('\n');
        assert.strictEqual(lines[15], 'SI001234');
    });

    test('Payload: polje 20 je kontrolna vsota (3 mesta)', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        const lines = payload.split('\n');
        const checksum = lines[19]; // 20. polje (indeks 19)
        assert.strictEqual(checksum.length, 3);
        assert.ok(/^\d{3}$/.test(checksum));
    });

    test('Payload: ne presega 411 bajtov', () => {
        const payload = QrGenerator.generatePayload(dummyData);
        const byteLen = Utils.encodeIso88592(payload, true).length;
        assert.ok(byteLen <= 411, `Payload je ${byteLen} bajtov (max 411)`);
    });

    test('Payload: polog zastavica se pravilno nastavi', () => {
        const payload = QrGenerator.generatePayload({ ...dummyData, polog: true });
        const lines = payload.split('\n');
        assert.strictEqual(lines[2], 'X'); // polje 3 = polog
    });

    test('Payload: dvig zastavica se pravilno nastavi', () => {
        const payload = QrGenerator.generatePayload({ ...dummyData, dvig: true });
        const lines = payload.split('\n');
        assert.strictEqual(lines[3], 'X'); // polje 4 = dvig
    });

    test('Payload: explicit mode polog se pravilno nastavi', () => {
        const payload = QrGenerator.generatePayload({ ...dummyData, mode: 'polog' });
        const lines = payload.split('\n');
        assert.strictEqual(lines[2], 'X');
    });

    test('Payload: explicit mode dvig se pravilno nastavi', () => {
        const payload = QrGenerator.generatePayload({ ...dummyData, mode: 'dvig' });
        const lines = payload.split('\n');
        assert.strictEqual(lines[3], 'X');
    });

    test('Payload: nujno zastavica se pravilno nastavi', () => {
        const payload = QrGenerator.generatePayload({ ...dummyData, nujno: true });
        const lines = payload.split('\n');
        assert.strictEqual(lines[10], 'X'); // polje 11 = nujno
    });

    test('Payload: nujno alias urgent deluje', () => {
        const payload = QrGenerator.generatePayload({ ...dummyData, urgent: true });
        const lines = payload.split('\n');
        assert.strictEqual(lines[10], 'X');
    });

    test('Payload: payerCity alias deluje', () => {
        const d = { ...dummyData };
        delete d.payerPlace;
        d.payerCity = '2000 MARIBOR';
        const payload = QrGenerator.generatePayload(d);
        const lines = payload.split('\n');
        assert.strictEqual(lines[7], '2000 MARIBOR');
    });

    test('Payload: vrze napako pri predolgem besedilnem polju', () => {
        // Generator preveri vsako polje posebej - ime placnika max 33 bajtov
        assert.throws(() => {
            QrGenerator.generatePayload({
                ...dummyData,
                payerName: 'A'.repeat(34),  // 34 > 33 = napaka
            });
        }, /predolgo/i);
    });

    test('Payload: vrze napako pri nepodprtem znaku', () => {
        assert.throws(() => {
            QrGenerator.generatePayload({
                ...dummyData,
                payerName: 'JANEZ \u{1F642} NOVAK',
            });
        }, /podprt/i);
    });

    // ─── EPC Payload ──────────────────────────────────────────────────────────

    console.log('\n── EPC Payload ──');

    test('EPC: zacetek z BCD 002 1 SCT', () => {
        const epc = QrGenerator.generateEpcPayload(dummyData);
        assert.ok(epc.startsWith('BCD\n002\n1\nSCT\n'));
    });

    test('EPC: vsebuje ime prejemnika', () => {
        const epc = QrGenerator.generateEpcPayload(dummyData);
        assert.ok(epc.includes('PODJETJE D.O.O.'));
    });

    test('EPC: vsebuje IBAN prejemnika', () => {
        const epc = QrGenerator.generateEpcPayload(dummyData);
        assert.ok(epc.includes('SI56020170014356205'));
    });

    test('EPC: vsebuje znesek v formatu EURxx.xx', () => {
        const epc = QrGenerator.generateEpcPayload(dummyData);
        assert.ok(epc.includes('EUR150.00'));
    });

    test('EPC: vrze napako brez imena prejemnika', () => {
        assert.throws(() => {
            QrGenerator.generateEpcPayload({ ...dummyData, recipientName: '' });
        }, /ime prejemnika/i);
    });

    test('EPC: vrze napako pri neveljavnem IBAN', () => {
        assert.throws(() => {
            QrGenerator.generateEpcPayload({ ...dummyData, recipientIban: 'INVALID' });
        }, /SEPA IBAN/i);
    });

    test('EPC: vrze napako pri neveljavnem BIC', () => {
        assert.throws(() => {
            QrGenerator.generateEpcPayload({ ...dummyData, epcBic: 'INVALID' });
        }, /BIC/i);
    });

    test('EPC: veljaven BIC z 8 znaki', () => {
        const epc = QrGenerator.generateEpcPayload({ ...dummyData, epcBic: 'LJBASI2X' });
        assert.ok(epc.includes('LJBASI2X'));
    });

    test('EPC: veljaven BIC z 11 znaki', () => {
        const epc = QrGenerator.generateEpcPayload({ ...dummyData, epcBic: 'LJBASI2XXXX' });
        assert.ok(epc.includes('LJBASI2XXXX'));
    });

    test('EPC: ne presega 331 bajtov', () => {
        const epc = QrGenerator.generateEpcPayload(dummyData);
        const byteLen = new TextEncoder().encode(epc).length;
        assert.ok(byteLen <= 331, `EPC payload je ${byteLen} bajtov (max 331)`);
    });

    test('EPC: brez zneska je znesek prazen', () => {
        const epc = QrGenerator.generateEpcPayload({ ...dummyData, amount: '' });
        const lines = epc.split('\n');
        assert.strictEqual(lines[7], ''); // Znesek prazen
    });

    // ─── Image generacija ────────────────────────────────────────────────────

    console.log('\n── Generacija slik ──');

    await asyncTest('PNG: vrne base64 data URI', async () => {
        const png = await QrGenerator.generateImage(dummyData, { format: 'png' });
        assert.ok(png.startsWith('data:image/png;base64,'));
    });

    await asyncTest('PNG: ima zadostno dolzino', async () => {
        const png = await QrGenerator.generateImage(dummyData, { format: 'png' });
        assert.ok(png.length > 100);
    });

    await asyncTest('SVG: vrne SVG niz', async () => {
        const svg = await QrGenerator.generateImage(dummyData, { format: 'svg' });
        assert.ok(svg.startsWith('<svg'));
    });

    await asyncTest('SVG: vsebuje SVG strukturo', async () => {
        const svg = await QrGenerator.generateImage(dummyData, { format: 'svg' });
        assert.ok(svg.includes('</svg>'));
    });

    await asyncTest('EPC PNG: vrne base64 data URI', async () => {
        const epcPng = await QrGenerator.generateImage(dummyData, { format: 'png', type: 'epc' });
        assert.ok(epcPng.startsWith('data:image/png;base64,'));
    });

    await asyncTest('EPC SVG: vrne SVG niz', async () => {
        const epcSvg = await QrGenerator.generateImage(dummyData, { format: 'svg', type: 'epc' });
        assert.ok(epcSvg.startsWith('<svg'));
    });

    await asyncTest('UPN in EPC QR sta razlicna', async () => {
        const upnPng = await QrGenerator.generateImage(dummyData, { format: 'png', type: 'upn' });
        const epcPng = await QrGenerator.generateImage(dummyData, { format: 'png', type: 'epc' });
        assert.notStrictEqual(upnPng, epcPng);
    });

    // ─── Povzetek ────────────────────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════');
    if (failed > 0) {
        console.log(`  NAPAKA: ${failed}/${passed + failed} testov NEUSPEŠNIH!`);
        process.exit(1);
    } else {
        console.log(`  OK: Vseh ${passed} QrGenerator testov uspešno!`);
    }
    console.log('═══════════════════════════════════════\n');
}

runTests();
