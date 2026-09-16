import { PdfBuilder } from '../src/core/pdf-builder.js';
import assert from 'assert';

console.log('Running PdfBuilder tests...');

async function runTests() {
    const dummyData = {
        payerName: 'JANEZ NOVAK',
        payerAddress: 'SLOVENSKA 1',
        payerPlace: '1000 LJUBLJANA',
        amount: '150.00',
        purposeCode: 'OTHR',
        purpose: 'TESTNO PLACILO',
        paymentDate: '2026-06-01',
        recipientIban: 'SI56020170014356205',
        recipientRefCode: 'SI00',
        recipientRef: '1234',
        recipientName: 'PODJETJE D.O.O.',
        recipientAddress: 'ZOSENOVA 2',
        recipientPlace: '2000 MARIBOR',
    };

    try {
        const exactPdf = await PdfBuilder.generateUpnPdf(dummyData, { format: 'exact' });
        assert.ok(exactPdf instanceof Uint8Array, 'Should return a Uint8Array for exact format');
        assert.ok(exactPdf.length > 1000, 'Exact PDF should have some size');
        console.log('✅ Exact PDF generated successfully');

        const a4Pdf = await PdfBuilder.generateUpnPdf(dummyData, { format: 'a4' });
        assert.ok(a4Pdf instanceof Uint8Array, 'Should return a Uint8Array for a4 format');
        assert.ok(a4Pdf.length > 1000, 'A4 PDF should have some size');
        console.log('✅ A4 PDF generated successfully');

        console.log('✅ All PdfBuilder tests passed!');
    } catch (e) {
        console.error('❌ PdfBuilder tests failed:', e);
        process.exit(1);
    }
}

runTests();
