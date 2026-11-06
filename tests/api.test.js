import { buildServer } from '../src/server.js';
import assert from 'assert';

process.env.API_KEY = 'test-api-key';

let passed = 0;
let failed = 0;

async function test(name, fn) {
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

    const headers = { authorization: 'Bearer test-api-key' };

    console.log('\n═══════════════════════════════════════');
    console.log('  API Routes Tests');
    console.log('═══════════════════════════════════════\n');

    // ─── Zdravje in Avtentikacija ─────────────────────────────────────────────

    console.log('── Zdravje in Avtentikacija ──');

    await test('/api/health: vrne status ok', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/health' });
        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.status, 'ok');
        assert.ok(body.timestamp, 'Mora vsebovati timestamp');
    });

    await test('/health (root): vrne status ok brez avtentikacije', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.status, 'ok');
        assert.ok(body.timestamp, 'Mora vsebovati timestamp');
    });

    await test('CSP dovoljuje blob predogled generiranega PDF', async () => {
        const res = await app.inject({ method: 'GET', url: '/' });
        const csp = res.headers['content-security-policy'];
        assert.ok(csp.includes('frame-src'));
        assert.ok(csp.includes('blob:'));
        assert.ok(!csp.includes('fonts.googleapis.com'));
    });

    await test('Lokalni tester lahko naloži samo določene vzorčne datoteke', async () => {
        const csv = await app.inject({ method: 'GET', url: '/samples/primer-batch-3-racuni.csv' });
        assert.strictEqual(csv.statusCode, 200);
        assert.ok(csv.headers['content-type'].startsWith('text/csv'));
        assert.ok(csv.payload.includes('TESTNI PLAČNIK 1'));
        const json = await app.inject({ method: 'GET', url: '/samples/primer-batch-3-racuni.json' });
        assert.strictEqual(json.statusCode, 200);
        assert.ok(JSON.parse(json.payload).length === 3);
        const parser = await app.inject({ method: 'GET', url: '/csv-import.js' });
        assert.strictEqual(parser.statusCode, 200);
        assert.ok(parser.payload.includes('parseCsvBatch'));
        const html = await app.inject({ method: 'GET', url: '/' });
        assert.ok(html.payload.includes('Več nalogov iz CSV ali JSON'));
        assert.ok(html.payload.includes("import { parseCsvBatch, parseJsonBatch } from './csv-import.js'"));

        const unknown = await app.inject({ method: 'GET', url: '/samples/.env' });
        assert.strictEqual(unknown.statusCode, 404);
        const prototype = await app.inject({ method: 'GET', url: '/samples/__proto__' });
        assert.strictEqual(prototype.statusCode, 404);
    });

    await test('Brez tokena: 401 Unauthorized', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/validate', payload: dummyData });
        assert.strictEqual(res.statusCode, 401);
        assert.ok(!res.payload.includes('test-api-key'));
    });

    await test('Manjkajoc API_KEY: 503 Service Unavailable', async () => {
        const apiKey = process.env.API_KEY;
        delete process.env.API_KEY;
        try {
            const res = await app.inject({
                method: 'POST',
                url: '/api/validate',
                payload: dummyData
            });
            assert.strictEqual(res.statusCode, 503);
        } finally {
            process.env.API_KEY = apiKey;
        }
    });

    await test('Napacen token: 403 Forbidden', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: dummyData,
            headers: { authorization: 'Bearer napacen_kljuc' }
        });
        assert.strictEqual(res.statusCode, 403);
    });

    await test('Brez Bearer predpone: 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: dummyData,
            headers: { authorization: headers.authorization.replace(/^Bearer /, '') }
        });
        assert.strictEqual(res.statusCode, 401);
    });

    // ─── /api/validate ────────────────────────────────────────────────────────

    console.log('\n── /api/validate ──');

    await test('Veljavni podatki: valid=true', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/validate', payload: dummyData, headers });
        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.valid, true);
        assert.strictEqual(body.errors.length, 0);
    });

    await test('Manjkajoc znesek: valid=false', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: { ...dummyData, amount: '' },
            headers
        });
        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.valid, false);
        assert.ok(body.errors.length > 0);
        assert.ok(body.errors.some(e => e.field === 'amount'));
    });

    await test('Neveljavna koda namena: valid=false', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: { ...dummyData, purposeCode: 'XXXX' },
            headers
        });
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.valid, false);
        assert.ok(body.errors.some(e => e.field === 'purposeCode'));
    });

    await test('Neveljavna IBAN: valid=false', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: { ...dummyData, recipientIban: 'SI56020170014356200' },
            headers
        });
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.valid, false);
        assert.ok(body.errors.some(e => e.field === 'recipientIban'));
    });

    await test('Humanitarno z datumom: valid=false', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: { ...dummyData, mode: 'humanitarno', paymentDate: '2026-06-01' },
            headers
        });
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.valid, false);
        assert.ok(body.errors.some(e => e.field === 'paymentDate'));
    });

    await test('Aliasi: payerCity, recipientCity, nujno delujejo', async () => {
        const aliasData = {
            ...dummyData,
            payerCity: '1000 LJUBLJANA',
            recipientCity: '2000 MARIBOR',
            nujno: false
        };
        delete aliasData.payerPlace;
        delete aliasData.recipientPlace;
        const res = await app.inject({ method: 'POST', url: '/api/validate', payload: aliasData, headers });
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.valid, true);
    });

    await test('Znesek kot stevilka (number): valid=true', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/validate',
            payload: { ...dummyData, amount: 150 },
            headers
        });
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.valid, true);
    });

    // ─── /api/pdf ─────────────────────────────────────────────────────────────

    console.log('\n── /api/pdf ──');

    await test('PDF exact: vrne application/pdf', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/pdf', payload: dummyData, headers });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'application/pdf');
        assert.ok(res.rawPayload.length > 1000);
    });

    await test('PDF a4: vrne application/pdf', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/pdf/a4', payload: dummyData, headers });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'application/pdf');
        assert.ok(res.rawPayload.length > 1000);
    });

    await test('PDF: neveljavni podatki = 400 Bad Request', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/pdf',
            payload: { ...dummyData, amount: '' },
            headers
        });
        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.payload);
        assert.ok(body.error);
        assert.ok(body.details);
    });

    // ─── /api/qr ──────────────────────────────────────────────────────────────

    console.log('\n── /api/qr ──');

    await test('QR PNG: vrne image/png', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/qr', payload: dummyData, headers });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'image/png');
        assert.ok(res.rawPayload.length > 100);
    });

    await test('QR SVG: vrne image/svg+xml', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/qr?format=svg',
            payload: dummyData,
            headers
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'image/svg+xml');
        assert.ok(res.payload.includes('<svg'));
    });

    await test('QR: neveljavni podatki = 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/qr',
            payload: { ...dummyData, amount: '' },
            headers
        });
        assert.strictEqual(res.statusCode, 400);
    });

    // ─── /api/epc-qr ─────────────────────────────────────────────────────────

    console.log('\n── /api/epc-qr ──');

    await test('EPC QR PNG: vrne image/png', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/epc-qr', payload: dummyData, headers });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'image/png');
        assert.ok(res.rawPayload.length > 100);
    });

    await test('EPC QR SVG: vrne image/svg+xml', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/epc-qr?format=svg',
            payload: dummyData,
            headers
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'image/svg+xml');
    });

    await test('EPC QR: brez prejemnika = 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/epc-qr',
            payload: { ...dummyData, recipientName: '' },
            headers
        });
        assert.strictEqual(res.statusCode, 400);
    });

    // ─── /api/batch ───────────────────────────────────────────────────────────

    console.log('\n── /api/batch ──');

    await test('Batch merge A4: vrne application/pdf', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [dummyData, dummyData], merge: true, format: 'a4' },
            headers
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'application/pdf');
        assert.ok(res.rawPayload.length > 2000);
    });

    await test('Batch a4-triple merge: vrne application/pdf', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [dummyData, dummyData, dummyData], merge: true, format: 'a4-triple' },
            headers
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'application/pdf');
        assert.ok(res.rawPayload.length > 2000);
    });

    await test('Batch ZIP: vrne application/zip', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [dummyData, dummyData], merge: false, format: 'exact' },
            headers
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'application/zip');
        assert.ok(res.rawPayload.length > 2000);
    });

    await test('Batch: neveljaven nalog v seriji = 400 z diagnostiko', async () => {
        const invalidData = { ...dummyData, amount: '', recipientIban: '' };
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [dummyData, invalidData, dummyData], merge: true, format: 'exact' },
            headers
        });
        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.error, 'Batch validation failed');
        assert.strictEqual(body.totalItems, 3);
        assert.strictEqual(body.failedCount, 1);
        assert.ok(body.details.length === 1);
        assert.strictEqual(body.details[0].index, 1);
        assert.strictEqual(body.details[0].itemNumber, 2);
        assert.ok(body.details[0].errors.length >= 1);
    });

    await test('Batch: vsi neveljavni = 400 z vsemi napakami', async () => {
        const bad1 = { ...dummyData, amount: '' };
        const bad2 = { ...dummyData, recipientIban: '' };
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [bad1, bad2], merge: true, format: 'exact' },
            headers
        });
        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.failedCount, 2);
        assert.strictEqual(body.details.length, 2);
    });

    await test('Batch: en sam nalog = veljavni PDF', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [dummyData], merge: true, format: 'exact' },
            headers
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'application/pdf');
    });

    await test('Batch: diagnostika vsebuje payer in recipient', async () => {
        const invalidData = { ...dummyData, amount: '', payerName: 'ANA KRAJC', recipientName: 'ELEKTRO D.D.' };
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [invalidData], merge: true, format: 'exact' },
            headers
        });
        const body = JSON.parse(res.payload);
        assert.strictEqual(body.details[0].payer, 'ANA KRAJC');
        assert.strictEqual(body.details[0].recipient, 'ELEKTRO D.D.');
    });

    await test('Batch: brez avtorizacije = 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [dummyData], merge: true, format: 'exact' }
        });
        assert.strictEqual(res.statusCode, 401);
    });

    // ─── Content-Disposition ──────────────────────────────────────────────────

    console.log('\n── Content-Disposition ──');

    await test('PDF exact: ima Content-Disposition z imenom datoteke', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/pdf', payload: dummyData, headers });
        assert.ok(res.headers['content-disposition']);
        assert.ok(res.headers['content-disposition'].includes('.pdf'));
    });

    await test('Batch ZIP: ima Content-Disposition', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/batch',
            payload: { nalogi: [dummyData], merge: false, format: 'exact' },
            headers
        });
        assert.ok(res.headers['content-disposition']);
        assert.ok(res.headers['content-disposition'].includes('.zip'));
    });

    // ─── Povzetek ────────────────────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════');
    if (failed > 0) {
        console.log(`  NAPAKA: ${failed}/${passed + failed} testov NEUSPEŠNIH!`);
        process.exit(1);
    } else {
        console.log(`  OK: Vseh ${passed} API testov uspešno!`);
    }
    console.log('═══════════════════════════════════════\n');

    app.close();
}

runTests();
