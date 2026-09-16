import { Validator } from '../src/core/validator.js';
import assert from 'assert';

console.log('Running Validator tests...');

// Mod11 Tests
assert.strictEqual(Validator.calculateMod11('000000001234'), 3, 'Mod11: Simple calculation');
assert.strictEqual(Validator.calculateMod11('99'), 0, 'Mod11: K=0 case');

// SI Model Tests
assert.strictEqual(Validator.validateSI('SI120000000012343'), true, 'SI12: Valid 13-digit');
assert.strictEqual(Validator.validateSI('SI12123456789'), false, 'SI12: Invalid length');
assert.strictEqual(Validator.validateSI('SI05123456789092'), true, 'SI05: Valid Mod97');
assert.strictEqual(Validator.validateSI('SI1112343-5673'), true, 'SI11: Valid parts');

// ValidateForm
const storeValid = {
    amount: '150.00',
    payerName: 'JANEZ NOVAK',
    paymentDate: '2026-06-01',
    recipientName: 'PODJETJE D.O.O.',
    recipientIban: 'SI56020170014356205',
    purposeCode: 'OTHR',
    purpose: 'TEST',
};
const resultValid = Validator.validateForm(storeValid);
assert.strictEqual(resultValid.errors.length, 0, 'Valid form should have 0 errors');
assert.strictEqual(resultValid.warnings.length, 5, 'Valid form should have 5 warnings (missing addresses/dates)');

const storeInvalid = { ...storeValid, amount: '' };
const resultInvalid = Validator.validateForm(storeInvalid);
assert.strictEqual(resultInvalid.errors.length, 1, 'Invalid form should have 1 error for missing amount');
assert.strictEqual(resultInvalid.errors[0].field, 'amount');

console.log('✅ All tests passed!');
