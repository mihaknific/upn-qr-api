import { QrGenerator } from '../src/core/qr-generator.js';
import assert from 'assert';

console.log('Running QrGenerator tests...');

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
        const payload = QrGenerator.generatePayload(dummyData);
        assert.strictEqual(typeof payload, 'string');
        assert.ok(payload.startsWith('UPNQR\n'), 'Payload should start with UPNQR');
        assert.ok(payload.split('\n').length === 21, 'Payload should have 21 lines including the last empty newline');
        console.log('✅ QR Payload string generated correctly');

        const pngImage = await QrGenerator.generateImage(dummyData, { format: 'png' });
        assert.ok(pngImage.startsWith('data:image/png;base64,'), 'Should return base64 PNG');
        console.log('✅ QR PNG Image generated correctly');

        const svgImage = await QrGenerator.generateImage(dummyData, { format: 'svg' });
        assert.ok(svgImage.startsWith('<svg'), 'Should return SVG string');
        console.log('✅ QR SVG Image generated correctly');

        console.log('✅ All QrGenerator tests passed!');
    } catch (e) {
        console.error('❌ QrGenerator tests failed:', e);
        process.exit(1);
    }
}

runTests();
