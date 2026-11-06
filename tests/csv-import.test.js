import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCsvBatch, parseJsonBatch } from '../public/csv-import.js';

const samplePath = new URL('../primer-batch-3-racuni.csv', import.meta.url);
const sample = await readFile(samplePath, 'utf8');
const rows = parseCsvBatch(sample);

assert.equal(rows.length, 3);
assert.equal(rows[0].amount, '149,90');
assert.equal(rows[0].payerName, 'TESTNI PLAČNIK 1');
assert.equal(rows[2].recipientCity, '3000 CELJE');

assert.deepEqual(parseCsvBatch('payerName,amount\n"Novak, Ana",12.50'), [
    { payerName: 'Novak, Ana', amount: '12.50' }
]);
assert.deepEqual(parseCsvBatch('payerName;purpose\n"NOVAK";"Prva vrstica\nDruga vrstica"'), [
    { payerName: 'NOVAK', purpose: 'Prva vrstica\nDruga vrstica' }
]);
assert.deepEqual(parseCsvBatch('\uFEFFpayerName;amount\r\nANA;1,20\r\n'), [
    { payerName: 'ANA', amount: '1,20' }
]);
assert.deepEqual(parseCsvBatch('payerName;urgent\nANA;da\nNOVAK;false'), [
    { payerName: 'ANA', urgent: true },
    { payerName: 'NOVAK', urgent: false }
]);
assert.deepEqual(parseJsonBatch('[{"amount":"1"},{"amount":"2"}]'), [
    { amount: '1' },
    { amount: '2' }
]);
assert.deepEqual(parseJsonBatch('{"nalogi":[{"amount":"1"}]}'), [
    { amount: '1' }
]);
assert.equal(parseCsvBatch(`payerName\n${Array.from({ length: 500 }, (_, index) => `TEST ${index}`).join('\n')}`).length, 500);
assert.equal(parseJsonBatch(JSON.stringify(Array.from({ length: 500 }, () => ({})))).length, 500);

for (const [parse, input, message] of [
    [parseCsvBatch, '', /prazna/],
    [parseCsvBatch, 'payerName', /vsaj eno vrstico/],
    [parseCsvBatch, 'payerName,payerName\nANA,ANA', /podvojen/],
    [parseCsvBatch, 'payerName,unknown\nANA,A', /Neznani CSV stolpci/],
    [parseCsvBatch, 'payerName;amount\nANA', /pričakovanih/],
    [parseCsvBatch, 'payerName\n"ANA', /nedokončano/],
    [parseCsvBatch, 'payerName;urgent\nANA;mogoče', /true\/false ali da\/ne/],
    [parseCsvBatch, `payerName\n${Array.from({ length: 501 }, (_, index) => `TEST ${index}`).join('\n')}`, /največ 500/],
    [parseJsonBatch, '{"nalogi":[]}', /vsaj en UPN nalog/],
    [parseJsonBatch, '{"nalogi":[null]}', /Vsak JSON nalog/],
    [parseJsonBatch, '{"nalogi":[{"payrName":"ANA"}]}', /neznana polja/],
    [parseJsonBatch, JSON.stringify(Array.from({ length: 501 }, () => ({}))), /največ 500/]
]) {
    assert.throws(() => parse(input), message);
}

console.log('CSV/JSON uvoz: vsi preizkusi uspešni.');
