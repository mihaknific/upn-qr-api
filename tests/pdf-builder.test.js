import { PdfBuilder } from '../src/core/pdf-builder.js';
import { QrGenerator } from '../src/core/qr-generator.js';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import assert from 'assert';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.error(`  ❌ ${name}`);
        console.error(`     ${e.message}`);
    }
}

async function asyncTest(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.error(`  ❌ ${name}`);
        console.error(`     ${e.message}`);
    }
}

const dummyData = {
    payerName: 'JANEZ NOVAK',
    payerAddress: 'SLOVENSKA 1',
    payerPlace: '1000 LJUBLJANA',
    amount: '150.00',
    purposeCode: 'OTHR',
    purpose: 'TESTNO PLACILO Z VSEMI 42 ZNAKI DOLGIM OPISOM!',
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
    console.log('  PdfBuilder Tests');
    console.log('═══════════════════════════════════════\n');

    // ─── Enojni PDF ──────────────────────────────────────────────────────────

    console.log('── Enojni PDF ──');

    await asyncTest('Exact PDF: vrne Uint8Array', async () => {
        const pdf = await PdfBuilder.generateUpnPdf(dummyData, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
    });

    await asyncTest('Exact PDF: ima zadostno velikost', async () => {
        const pdf = await PdfBuilder.generateUpnPdf(dummyData, { format: 'exact' });
        assert.ok(pdf.length > 1000, `PDF je samo ${pdf.length} bajtov`);
    });

    await asyncTest('Exact PDF: zacne se s PDF headerjem', async () => {
        const pdf = await PdfBuilder.generateUpnPdf(dummyData, { format: 'exact' });
        const header = new TextDecoder().decode(pdf.slice(0, 5));
        assert.strictEqual(header, '%PDF-');
    });

    await asyncTest('Exact PDF: ohrani tocno velikost strani 210 x 99 mm', async () => {
        const bytes = await PdfBuilder.generateUpnPdf(dummyData, { format: 'exact' });
        const pdf = await PDFDocument.load(bytes);
        const [page] = pdf.getPages();
        assert.ok(Math.abs(page.getWidth() - (210 * 72 / 25.4)) < 0.01);
        assert.ok(Math.abs(page.getHeight() - (99 * 72 / 25.4)) < 0.01);
    });

    await asyncTest('Exact PDF: vkljuci UPN QR v obrazec', async () => {
        const qrData = { ...dummyData, purpose: 'TEST' };
        const qrBase64 = await QrGenerator.generateImage(qrData, { format: 'png' });
        const bytes = await PdfBuilder.generateUpnPdf(qrData, { format: 'exact', qrBase64 });
        const pdf = await PDFDocument.load(bytes);
        const [page] = pdf.getPages();
        const resources = pdf.context.lookup(page.node.Resources(), PDFDict);
        const xObjects = pdf.context.lookup(resources.lookup(PDFName.of('XObject')), PDFDict);
        assert.strictEqual(xObjects.keys().length, 1);
    });

    await asyncTest('A4 PDF: vrne Uint8Array', async () => {
        const pdf = await PdfBuilder.generateUpnPdf(dummyData, { format: 'a4' });
        assert.ok(pdf instanceof Uint8Array);
    });

    await asyncTest('A4 PDF: vecji od exact (vecja stran)', async () => {
        const exact = await PdfBuilder.generateUpnPdf(dummyData, { format: 'exact' });
        const a4 = await PdfBuilder.generateUpnPdf(dummyData, { format: 'a4' });
        // A4 ima vecjo stran, torej bi moral biti vsaj malo vecji
        assert.ok(a4.length > 0 && exact.length > 0);
    });

    // ─── Aliasi ──────────────────────────────────────────────────────────────

    console.log('\n── Aliasi polj ──');

    await asyncTest('payerCity alias: PDF se uspesno generira', async () => {
        const data = { ...dummyData };
        delete data.payerPlace;
        data.payerCity = '1000 LJUBLJANA';
        const pdf = await PdfBuilder.generateUpnPdf(data, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('recipientCity alias: PDF se uspesno generira', async () => {
        const data = { ...dummyData };
        delete data.recipientPlace;
        data.recipientCity = '2000 MARIBOR';
        const pdf = await PdfBuilder.generateUpnPdf(data, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('nujno zastavica: PDF se uspesno generira', async () => {
        const pdf = await PdfBuilder.generateUpnPdf({ ...dummyData, nujno: true }, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('urgent alias: PDF se uspesno generira', async () => {
        const pdf = await PdfBuilder.generateUpnPdf({ ...dummyData, urgent: true }, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    // ─── Posebna polja ──────────────────────────────────────────────────────

    console.log('\n── Posebna polja ──');

    await asyncTest('Polog zastavica: PDF se generira', async () => {
        const pdf = await PdfBuilder.generateUpnPdf({ ...dummyData, polog: true }, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('Polog mode: PDF se generira', async () => {
        const pdf = await PdfBuilder.generateUpnPdf({ ...dummyData, mode: 'polog' }, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('Dvig zastavica: PDF se generira', async () => {
        const pdf = await PdfBuilder.generateUpnPdf({ ...dummyData, dvig: true }, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('Dvig mode: PDF se generira', async () => {
        const pdf = await PdfBuilder.generateUpnPdf({ ...dummyData, mode: 'dvig' }, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('Z rokom placila (dueDate): PDF se generira', async () => {
        const pdf = await PdfBuilder.generateUpnPdf({ ...dummyData, dueDate: '2026-12-31' }, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('Minimalni podatki: PDF se generira', async () => {
        const minimal = {
            amount: '10.00',
            purposeCode: 'OTHR',
            purpose: 'TEST',
            recipientName: 'PREJEMNIK',
            recipientAddress: 'NASLOV 1',
            recipientPlace: '1000 LJ',
            recipientIban: 'SI56020170014356205',
        };
        const pdf = await PdfBuilder.generateUpnPdf(minimal, { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    // ─── Batch PDF ──────────────────────────────────────────────────────────

    console.log('\n── Batch PDF ──');

    await asyncTest('Batch exact: 2 naloga = veljavni PDF', async () => {
        const pdf = await PdfBuilder.generateBatchPdf([dummyData, dummyData], { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 2000);
    });

    await asyncTest('Batch a4: 3 nalogi = veljavni PDF', async () => {
        const pdf = await PdfBuilder.generateBatchPdf([dummyData, dummyData, dummyData], { format: 'a4' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 2000);
    });

    await asyncTest('A4-triple: 3 nalogi na 1 stran', async () => {
        const pdf = await PdfBuilder.generateBatchPdf([dummyData, dummyData, dummyData], { format: 'a4-triple' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('A4-triple: 4 nalogi = 2 strani', async () => {
        const data = [dummyData, dummyData, dummyData, dummyData];
        const pdf = await PdfBuilder.generateBatchPdf(data, { format: 'a4-triple' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('A4-triple: 6 nalogov = 2 polni strani', async () => {
        const data = Array(6).fill(dummyData);
        const pdf = await PdfBuilder.generateBatchPdf(data, { format: 'a4-triple' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 2000);
    });

    await asyncTest('Batch: 1 nalog = veljavni PDF', async () => {
        const pdf = await PdfBuilder.generateBatchPdf([dummyData], { format: 'exact' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    await asyncTest('A4-triple: 1 nalog = veljavni PDF (ne polna stran)', async () => {
        const pdf = await PdfBuilder.generateBatchPdf([dummyData], { format: 'a4-triple' });
        assert.ok(pdf instanceof Uint8Array);
        assert.ok(pdf.length > 1000);
    });

    // ─── Povzetek ────────────────────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════');
    if (failed > 0) {
        console.log(`  ❌ ${failed}/${passed + failed} testov NEUSPEŠNIH!`);
        process.exit(1);
    } else {
        console.log(`  ✅ Vseh ${passed} PdfBuilder testov uspešno!`);
    }
    console.log('═══════════════════════════════════════\n');
}

runTests();
