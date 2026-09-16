import { buildServer } from '../src/server.js';
import assert from 'assert';

console.log('Running API routes tests...');

async function runTests() {
    const app = buildServer();

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
    
    const headers = { authorization: 'Bearer dev_secret_key_2026' };

    try {
        // Test GET /api/health (No Auth Needed)
        const healthRes = await app.inject({
            method: 'GET',
            url: '/api/health'
        });
        assert.strictEqual(healthRes.statusCode, 200);
        const healthBody = JSON.parse(healthRes.payload);
        assert.strictEqual(healthBody.status, 'ok');
        console.log('✅ /api/health OK');

        // Test POST /api/validate (Unauthorized)
        const unauthRes = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: dummyData
        });
        assert.strictEqual(unauthRes.statusCode, 401);
        console.log('✅ Auth rejection OK');

        // Test POST /api/validate (Valid)
        const valRes = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: dummyData,
            headers
        });
        assert.strictEqual(valRes.statusCode, 200);
        const valBody = JSON.parse(valRes.payload);
        assert.strictEqual(valBody.valid, true);
        console.log('✅ /api/validate (Valid) OK');

        // Test POST /api/validate (Invalid)
        const invalidData = { ...dummyData, amount: '' };
        const invalRes = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: invalidData,
            headers
        });
        assert.strictEqual(invalRes.statusCode, 200); // Route returns 200 with valid:false
        const invalBody = JSON.parse(invalRes.payload);
        assert.strictEqual(invalBody.valid, false);
        assert.ok(invalBody.errors.length > 0);
        console.log('✅ /api/validate (Invalid) OK');

        // Test POST /api/pdf
        const pdfRes = await app.inject({
            method: 'POST',
            url: '/api/pdf',
            payload: dummyData,
            headers
        });
        assert.strictEqual(pdfRes.statusCode, 200);
        assert.strictEqual(pdfRes.headers['content-type'], 'application/pdf');
        assert.ok(pdfRes.rawPayload.length > 1000);
        console.log('✅ /api/pdf OK');

        // Test POST /api/qr
        const qrRes = await app.inject({
            method: 'POST',
            url: '/api/qr',
            payload: dummyData,
            headers
        });
        assert.strictEqual(qrRes.statusCode, 200);
        assert.strictEqual(qrRes.headers['content-type'], 'image/png');
        assert.ok(qrRes.rawPayload.length > 100);
        console.log('✅ /api/qr OK');

        // Test POST /api/batch (Merge = true -> PDF)
        const batchMergeRes = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: {
                nalogi: [dummyData, dummyData],
                merge: true,
                format: 'a4'
            },
            headers
        });
        assert.strictEqual(batchMergeRes.statusCode, 200);
        assert.strictEqual(batchMergeRes.headers['content-type'], 'application/pdf');
        assert.ok(batchMergeRes.rawPayload.length > 2000);
        console.log('✅ /api/batch (merge: true) OK');

        // Test POST /api/batch (Merge = false -> ZIP)
        const batchZipRes = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: {
                nalogi: [dummyData, dummyData],
                merge: false,
                format: 'exact'
            },
            headers
        });
        assert.strictEqual(batchZipRes.statusCode, 200);
        assert.strictEqual(batchZipRes.headers['content-type'], 'application/zip');
        assert.ok(batchZipRes.rawPayload.length > 2000);
        console.log('✅ /api/batch (merge: false) OK');

        console.log('✅ All API tests passed!');
    } catch (e) {
        console.error('❌ API tests failed:', e);
        process.exit(1);
    } finally {
        app.close();
    }
}

runTests();
