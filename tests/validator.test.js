import { Validator, SI_MODELS, SEPA_IBAN_COUNTRIES } from '../src/core/validator.js';
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

function assertValid(result, msg) {
    assert.strictEqual(result.errors.length, 0, `${msg} — errors: ${JSON.stringify(result.errors)}`);
}

function assertHasError(result, field, msg) {
    assert.ok(
        result.errors.some(e => e.field === field),
        `${msg} — expected error on '${field}', got: ${JSON.stringify(result.errors)}`
    );
}

function assertNoError(result, field, msg) {
    assert.ok(
        !result.errors.some(e => e.field === field),
        `${msg} — unexpected error on '${field}': ${JSON.stringify(result.errors.filter(e => e.field === field))}`
    );
}

// Osnovni veljavni podatki za referenco
const BASE_VALID = {
    amount: '150.00',
    payerName: 'JANEZ NOVAK',
    payerAddress: 'SLOVENSKA 1',
    payerPlace: '1000 LJUBLJANA',
    paymentDate: '2026-06-01',
    recipientName: 'PODJETJE D.O.O.',
    recipientAddress: 'DUNAJSKA 5',
    recipientPlace: '1000 LJUBLJANA',
    recipientIban: 'SI56020170014356205',
    purposeCode: 'OTHR',
    purpose: 'TESTNO PLACILO',
    recipientRefCode: 'SI00',
    recipientRef: '1234'
};

console.log('\n═══════════════════════════════════════');
console.log('  Validator Tests');
console.log('═══════════════════════════════════════\n');

// ─── Mod11 ────────────────────────────────────────────────────────────────────

console.log('── Mod11 ──');

test('Mod11: osnoven izracun', () => {
    assert.strictEqual(Validator.calculateMod11('000000001234'), 3);
});

test('Mod11: K=0 primer', () => {
    assert.strictEqual(Validator.calculateMod11('99'), 0);
});

test('Mod11: enovrsticni podatek', () => {
    assert.strictEqual(Validator.calculateMod11('1'), 9);
});

test('Mod11: vecje stevilo', () => {
    const result = Validator.calculateMod11('123456789');
    assert.ok(result >= 0 && result <= 10, 'Rezultat mora biti 0-10');
});

// ─── SI Reference — vsi modeli ────────────────────────────────────────────────

console.log('\n── SI Reference ──');

// SI00 — brez kontrole, 1-3 skupine
test('SI00: veljavna referenca z 1 skupino', () => {
    assert.strictEqual(Validator.validateSI('SI001234'), true);
});

test('SI00: veljavna referenca s pomisljaji', () => {
    assert.strictEqual(Validator.validateSI('SI001234-5678'), true);
});

test('SI00: veljavna referenca z 3 skupinami', () => {
    assert.strictEqual(Validator.validateSI('SI001234-5678-9012'), true);
});

test('SI00: neveljavna (prazna vsebina)', () => {
    assert.strictEqual(Validator.validateSI('SI00'), false);
});

// SI01 — kontrola na celotni vsebini (vsi 1-3 skupin skupaj)
test('SI01: veljavna referenca', () => {
    assert.strictEqual(Validator.validateSI('SI01123456789016'), true);
});

test('SI01: neveljavna kontrolna stevilka', () => {
    assert.strictEqual(Validator.validateSI('SI01123456789010'), false);
});

// SI05 — kontrola na 1. skupini
test('SI05: veljavna referenca', () => {
    assert.strictEqual(Validator.validateSI('SI051026747'), true);
});

test('SI05: neveljavna kontrola', () => {
    assert.strictEqual(Validator.validateSI('SI051026748'), false);
});

// SI12 — fiksna dolzina 13, ena skupina
test('SI12: veljavna referenca z 13 mesti', () => {
    assert.strictEqual(Validator.validateSI('SI120000000000140'), true);
});

test('SI12: neveljavna (prekratka)', () => {
    assert.strictEqual(Validator.validateSI('SI12123456789'), false);
});

test('SI12: neveljavna (predolga)', () => {
    assert.strictEqual(Validator.validateSI('SI1200000000001401'), false);
});

// SI99 — prazna vsebina
test('SI99: veljavna (prazna vsebina)', () => {
    assert.strictEqual(Validator.validateSI('SI99'), true);
});

test('SI99: neveljavna (vsebina prisotna)', () => {
    assert.strictEqual(Validator.validateSI('SI991'), false);
});

test('SI99: neveljavna (skupina prisotna)', () => {
    assert.strictEqual(Validator.validateSI('SI99123'), false);
});

// Osnovne napake
test('SI: prazen niz', () => {
    assert.strictEqual(Validator.validateSI(''), false);
});

test('SI: null', () => {
    assert.strictEqual(Validator.validateSI(null), false);
});

test('SI: neobstojeci model', () => {
    assert.strictEqual(Validator.validateSI('SI131234'), false);
});

test('SI: neobstojeci model SI14', () => {
    assert.strictEqual(Validator.validateSI('SI141234'), false);
});

test('SI: prevec skupin za model z maxGroups=1', () => {
    assert.strictEqual(Validator.validateSI('SI12000000000014-123'), false);
});

// Preverjamo, da so vsi modeli definirani
test('SI_MODELS: vseh 28 modelov je definiranih', () => {
    const expected = ['00','01','02','03','04','05','06','07','08','09','10','11','12',
                      '18','19','21','22','23','28','31','32','38','40','41','48','49','51','55','58','99'];
    expected.forEach(model => {
        assert.ok(SI_MODELS[model] !== undefined, `Model SI${model} manjka!`);
    });
    assert.strictEqual(Object.keys(SI_MODELS).length, expected.length, 'Stevilo modelov se ne ujema');
});

// Omejeni modeli (restricted)
test('SI22: oznacen kot omejen (restricted)', () => {
    assert.ok(SI_MODELS['22'].restricted);
});

test('SI32: oznacen kot omejen (restricted)', () => {
    assert.ok(SI_MODELS['32'].restricted);
});

test('SI58: oznacen kot omejen (restricted)', () => {
    assert.ok(SI_MODELS['58'].restricted);
});

test('SI00: NI omejen', () => {
    assert.ok(!SI_MODELS['00'].restricted);
});

// ─── RF Reference ─────────────────────────────────────────────────────────────

console.log('\n── RF Reference ──');

test('RF: veljavna referenca RF712348231', () => {
    assert.strictEqual(Validator.validateRF('RF712348231'), true);
});

test('RF: neveljavna referenca RF00123', () => {
    assert.strictEqual(Validator.validateRF('RF00123'), false);
});

test('RF: prazen niz', () => {
    assert.strictEqual(Validator.validateRF(''), false);
});

test('RF: null', () => {
    assert.strictEqual(Validator.validateRF(null), false);
});

test('RF: prekratka', () => {
    assert.strictEqual(Validator.validateRF('RF71'), false);
});

test('RF: predolga (26+ znakov)', () => {
    assert.strictEqual(Validator.validateRF('RF71' + '1'.repeat(22)), false);
});

test('RF: z manjso zacetnico (case insensitive)', () => {
    assert.strictEqual(Validator.validateRF('rf712348231'), true);
});

// ─── IBAN Validacija ──────────────────────────────────────────────────────────

console.log('\n── IBAN Validacija ──');

test('IBAN: veljaven slovenski IBAN', () => {
    assert.strictEqual(Validator.validateIBAN('SI56020170014356205'), true);
});

test('IBAN: veljaven naracun SI56 s presledki', () => {
    assert.strictEqual(Validator.validateIBAN('SI56 0201 7001 4356 205'), true);
});

test('IBAN: neveljavna kontrolna stevilka', () => {
    assert.strictEqual(Validator.validateIBAN('SI56020170014356200'), false);
});

test('IBAN: prazen', () => {
    assert.strictEqual(Validator.validateIBAN(''), false);
});

test('IBAN: null', () => {
    assert.strictEqual(Validator.validateIBAN(null), false);
});

test('IBAN: napacna dolzina za drzavo', () => {
    assert.strictEqual(Validator.validateIBAN('SI5602017001435620'), false); // 18 mesto, 19
});

test('IBAN: veljavni nemski IBAN', () => {
    assert.strictEqual(Validator.validateIBAN('DE89370400440532013000'), true);
});

test('IBAN: veljavni avstrijski IBAN', () => {
    assert.strictEqual(Validator.validateIBAN('AT611904300234573201'), true);
});

// ─── SEPA IBAN ────────────────────────────────────────────────────────────────

console.log('\n── SEPA IBAN ──');

test('SEPA IBAN: SI je SEPA drzava', () => {
    assert.strictEqual(SEPA_IBAN_COUNTRIES.has('SI'), true);
});

test('SEPA IBAN: DE je SEPA drzava', () => {
    assert.strictEqual(SEPA_IBAN_COUNTRIES.has('DE'), true);
});

test('SEPA IBAN: veljaven SI IBAN je SEPA', () => {
    assert.strictEqual(Validator.validateSepaIBAN('SI56020170014356205'), true);
});

test('SEPA IBAN: neveljaven IBAN ni SEPA', () => {
    assert.strictEqual(Validator.validateSepaIBAN('SI56020170014356200'), false);
});

// ─── calculateRFCheckDigits ──────────────────────────────────────────────

console.log('\n── RF Kontrolne Stevilke ──');

test('RF kontrolne stevilke: izracun za znan primer', () => {
    // RF712348231 je veljavna -> "2348231" + RF + check digits = 71
    const cd = Validator.calculateRFCheckDigits('2348231');
    assert.strictEqual(cd, '71');
});

// ─── validateForm: Osnovno ────────────────────────────────────────────────────

console.log('\n── validateForm: Osnovno ──');

test('Veljavni podatki: brez napak', () => {
    const r = Validator.validateForm(BASE_VALID);
    assertValid(r, 'Popolni podatki morajo biti veljavni');
});

test('Manjkajoc znesek: napaka na polju amount', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: '' });
    assertHasError(r, 'amount', 'Prazen znesek mora sprožiti napako');
    assert.strictEqual(r.errors.length, 1);
});

test('Manjkajoc payerName: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, payerName: '' });
    assertHasError(r, 'payerName', 'Prazno ime plačnika mora sprožiti napako');
});

test('Manjkajoc recipientIban: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, recipientIban: '' });
    assertHasError(r, 'recipientIban', 'Prazen IBAN prejemnika mora sprožiti napako');
});

test('Manjkajoca koda namena: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, purposeCode: '' });
    assertHasError(r, 'purposeCode', 'Prazna koda namena mora sprožiti napako');
});

test('Manjkajoc namen: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, purpose: '' });
    assertHasError(r, 'purpose', 'Prazen namen mora sprožiti napako');
});

// ─── validateForm: Znesek ─────────────────────────────────────────────────────

console.log('\n── validateForm: Znesek ──');

test('Negativen znesek: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: '-50.00' });
    assertHasError(r, 'amount', 'Negativen znesek');
});

test('Znesek z vejico: sprejeto', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: '150,50' });
    assertNoError(r, 'amount', 'Znesek z vejico mora biti sprejet');
});

test('Znesek presega max (999999999.99): napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: '1000000000.00' });
    assertHasError(r, 'amount', 'Prevelik znesek');
});

test('Znesek tocno max (999999999.99): sprejeto', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: '999999999.99' });
    assertNoError(r, 'amount', 'Znesek na meji mora biti sprejet');
});

test('Znesek 0 (nehumanitarni): napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: '0' });
    assertHasError(r, 'amount', 'Znesek 0 mora sprožiti napako');
});

test('Znesek s tremi decimalni mesti: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: '150.123' });
    assertHasError(r, 'amount', 'Tri decimalna mesta');
});

test('Neveljavni tekst v znesku: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, amount: 'abc' });
    assertHasError(r, 'amount', 'Tekst namesto zneska');
});

// ─── validateForm: Datum ──────────────────────────────────────────────────────

console.log('\n── validateForm: Datum ──');

test('Neveljavna oblika datuma: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, paymentDate: '01-06-2026' });
    assertHasError(r, 'paymentDate', 'Napacna oblika datuma');
});

test('Neobstojec datum (30. februar): napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, paymentDate: '2026-02-30' });
    assertHasError(r, 'paymentDate', 'Datum 30. feb ne obstaja');
});

test('Neobstojec datum (31. april): napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, paymentDate: '2026-04-31' });
    assertHasError(r, 'paymentDate', 'Datum 31. apr ne obstaja');
});

test('Veljaven datum: brez napake', () => {
    const r = Validator.validateForm({ ...BASE_VALID, paymentDate: '2026-12-31' });
    assertNoError(r, 'paymentDate', 'Veljaven datum');
});

// ─── validateForm: Nacin (Mode) ───────────────────────────────────────────────

console.log('\n── validateForm: Nacin (Mode) ──');

test('Humanitarno: prepovedano paymentDate', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'humanitarno',
        paymentDate: '2026-06-01'
    });
    assertHasError(r, 'paymentDate', 'Datum prepovedano pri humanitarnem');
});

test('Humanitarno: prepovedano payerIban', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'humanitarno',
        payerIban: 'SI56020170014356205'
    });
    assertHasError(r, 'payerIban', 'IBAN plačnika prepovedano pri humanitarnem');
});

test('Humanitarno: prepovedano nujno', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'humanitarno',
        nujno: true
    });
    assertHasError(r, 'nujno', 'Nujno prepovedano pri humanitarnem');
});

test('Humanitarno: obvezna referenca prejemnika', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'humanitarno',
        paymentDate: '',
        recipientRefCode: '',
        recipientRef: ''
    });
    assertHasError(r, 'recipientRef', 'Referenca obvezna pri humanitarnem');
});

test('Humanitarno: znesek 0 dovoljen', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'humanitarno',
        amount: '0',
        paymentDate: ''
    });
    assertNoError(r, 'amount', 'Znesek 0 dovoljen pri humanitarnem');
});

test('Polog: IBAN placnika prepovedano', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        polog: true,
        payerIban: 'SI56020170014356205'
    });
    assertHasError(r, 'payerIban', 'IBAN plačnika prepovedano pri pologu');
});

test('Polog: explicit mode zahteva datum in je veljaven', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'polog',
        paymentDate: '2026-06-01'
    });
    assertNoError(r, 'mode', 'Polog preko mode');
});

test('Dvig: explicit mode uveljavi pravila dviga', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'dvig',
        payerIban: 'SI56020170014356205',
        recipientIban: '',
        recipientRefCode: '',
        recipientRef: ''
    });
    assertNoError(r, 'mode', 'Dvig preko mode');
    assertNoError(r, 'payerIban', 'IBAN plačnika obvezen pri dvigu');
});

test('Dvig: IBAN prejemnika prepovedano', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        dvig: true,
        paymentDate: '2026-06-01'
    });
    assertHasError(r, 'recipientIban', 'IBAN prejemnika prepovedano pri dvigu');
});

test('Polog + Dvig hkrati: napaka', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        polog: true,
        dvig: true,
        paymentDate: '2026-06-01'
    });
    assertHasError(r, 'mode', 'Polog in Dvig se izključujeta');
});

test('Nasprotujoči mode in zastavica: napaka', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        mode: 'dvig',
        polog: true
    });
    assertHasError(r, 'mode', 'Načini naloga se morajo ujemati');
});

// ─── validateForm: Omejeni modeli (restricted) ────────────────────────────────

console.log('\n── validateForm: Omejeni Modeli ──');

test('SI22 zavrnjen v navadnem obrazcu', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'SI22',
        recipientRef: '12345'
    });
    assertHasError(r, 'recipientRefCode', 'SI22 je omejen model');
});

test('SI32 zavrnjen v navadnem obrazcu', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'SI32',
        recipientRef: '12345'
    });
    assertHasError(r, 'recipientRefCode', 'SI32 je omejen model');
});

test('SI58 zavrnjen v navadnem obrazcu', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'SI58',
        recipientRef: '12345'
    });
    assertHasError(r, 'recipientRefCode', 'SI58 je omejen model');
});

// ─── validateForm: JFP IBAN ──────────────────────────────────────────────────

console.log('\n── validateForm: JFP Referenca ──');

test('JFP IBAN (SI5601*): referenca je obvezna', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientIban: 'SI56011006000002985',
        recipientRefCode: '',
        recipientRef: ''
    });
    assertHasError(r, 'recipientRef', 'Referenca obvezna za JFP');
});

test('JFP IBAN z veljavno referenco: brez napake', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientIban: 'SI56011006000002985',
        recipientRefCode: 'SI00',
        recipientRef: '12345'
    });
    assertNoError(r, 'recipientRef', 'JFP z veljavno referenco');
});

// ─── validateForm: Koda namena (Purpose Code) ────────────────────────────────

console.log('\n── validateForm: Koda Namena ──');

test('Veljavna koda namena OTHR: brez napake', () => {
    const r = Validator.validateForm(BASE_VALID);
    assertNoError(r, 'purposeCode', 'OTHR je veljavna koda');
});

test('Veljavna koda namena GDSV: brez napake', () => {
    const r = Validator.validateForm({ ...BASE_VALID, purposeCode: 'GDSV' });
    assertNoError(r, 'purposeCode', 'GDSV je veljavna koda');
});

test('Neveljavna koda namena XXXX: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, purposeCode: 'XXXX' });
    assertHasError(r, 'purposeCode', 'XXXX ni veljavna koda');
});

test('Neveljavna koda namena ZZZZ: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, purposeCode: 'ZZZZ' });
    assertHasError(r, 'purposeCode', 'ZZZZ ni veljavna koda');
});

// ─── validateForm: IBAN Validacija v obrazcu ─────────────────────────────────

console.log('\n── validateForm: IBAN v obrazcu ──');

test('Neveljavna kontrolna stevilka recipientIban: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, recipientIban: 'SI56020170014356200' });
    assertHasError(r, 'recipientIban', 'Neveljaven IBAN prejemnika');
});

test('Ne-SEPA IBAN prejemnika: napaka', () => {
    // Uporabimo IBAN drzave, ki ni SEPA (npr. BR)
    const r = Validator.validateForm({ ...BASE_VALID, recipientIban: 'BR1500000000000010932840814P2' });
    assertHasError(r, 'recipientIban', 'Ne-SEPA IBAN mora sprožiti napako');
});

test('payerIban: samo SI IBAN dovoljen', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        dvig: true,
        paymentDate: '2026-06-01',
        payerIban: 'DE89370400440532013000', // DE IBAN
        recipientIban: ''
    });
    assertHasError(r, 'payerIban', 'Plačnikov IBAN mora biti SI');
});

// ─── validateForm: Valuta ────────────────────────────────────────────────────

console.log('\n── validateForm: Valuta ──');

test('Valuta EUR: brez napake', () => {
    const r = Validator.validateForm({ ...BASE_VALID, currency: 'EUR' });
    assertNoError(r, 'currency', 'EUR je veljavna valuta');
});

test('Valuta USD: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, currency: 'USD' });
    assertHasError(r, 'currency', 'USD ni dovoljena');
});

// ─── validateForm: ISO-8859-2 in dolzine polj ──────────────────────────────────

console.log('\n── validateForm: Znaki in dolzine polj ──');

test('Sumniki: č, š, ž so veljavni v ISO-8859-2', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        payerName: 'ČŠŽČŠŽ NOVAK',
        purpose: 'PLAČILO ZA ŠOLNINO Ž'
    });
    assertNoError(r, 'payerName', 'Sumniki morajo biti sprejeti');
    assertNoError(r, 'purpose', 'Sumniki v namenu morajo biti sprejeti');
});

test('Emoji v imenu placnika: napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, payerName: `JANEZ \u{1F642} NOVAK` });
    assertHasError(r, 'payerName', 'Emoji ni podprt v ISO-8859-2');
});

test('Predolgo ime placnika (>33 bajtov): napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, payerName: 'A'.repeat(34) });
    assertHasError(r, 'payerName', 'Predolgo ime placnika');
});

test('Predolg namen (>42 bajtov): napaka', () => {
    const r = Validator.validateForm({ ...BASE_VALID, purpose: 'A'.repeat(43) });
    assertHasError(r, 'purpose', 'Predolg namen');
});

test('Ime tocno 33 znakov: sprejeto', () => {
    const r = Validator.validateForm({ ...BASE_VALID, payerName: 'A'.repeat(33) });
    assertNoError(r, 'payerName', 'Ime tocno 33 znakov mora biti sprejeto');
});

test('Namen tocno 42 znakov: sprejeto', () => {
    const r = Validator.validateForm({ ...BASE_VALID, purpose: 'A'.repeat(42) });
    assertNoError(r, 'purpose', 'Namen tocno 42 znakov mora biti sprejet');
});

// ─── validateForm: Referenca SI v obrazcu ────────────────────────────────────

console.log('\n── validateForm: SI/RF referenca v obrazcu ──');

test('SI00 z referenco: veljavno', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'SI00',
        recipientRef: '1234-5678'
    });
    assertNoError(r, 'recipientRef', 'SI00 z referenco mora biti veljavna');
});

test('SI99 (brez vsebine): veljavno', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'SI99',
        recipientRef: ''
    });
    // SI99 ne zahteva reference
    assertNoError(r, 'recipientRef', 'SI99 brez vsebine mora biti veljavna');
});

test('Model brez vsebine (ni SI99): napaka', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'SI00',
        recipientRef: ''
    });
    assertHasError(r, 'recipientRef', 'Prazen sklic za SI00 mora sprožiti napako');
});

test('Vsebina brez modela: napaka', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: '',
        recipientRef: '12345'
    });
    assertHasError(r, 'recipientRefCode', 'Referenca brez modela mora sprožiti napako');
});

test('Neveljavna SI05 referenca v obrazcu: napaka', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'SI05',
        recipientRef: '1026748'  // napacna kontrolna (pravilna bi bila 1026747)
    });
    assertHasError(r, 'recipientRef', 'Neveljavna SI05 referenca');
});

test('Veljavna RF referenca v obrazcu: brez napake', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'RF',
        recipientRef: '712348231'
    });
    assertNoError(r, 'recipientRef', 'Veljavna RF referenca');
});

test('Neveljavna RF referenca v obrazcu: napaka', () => {
    const r = Validator.validateForm({
        ...BASE_VALID,
        recipientRefCode: 'RF',
        recipientRef: '00123'
    });
    assertHasError(r, 'recipientRef', 'Neveljavna RF referenca');
});

// ─── validateForm: Aliasi (payerCity/payerPlace, nujno/urgent) ───────────────

console.log('\n── validateForm: Aliasi ──');

test('payerCity alias deluje namesto payerPlace', () => {
    const data = { ...BASE_VALID };
    delete data.payerPlace;
    data.payerCity = '1000 LJUBLJANA';
    const r = Validator.validateForm(data);
    assertNoError(r, 'payerCity', 'payerCity alias mora delovati');
});

test('recipientCity alias deluje namesto recipientPlace', () => {
    const data = { ...BASE_VALID };
    delete data.recipientPlace;
    data.recipientCity = '1000 LJUBLJANA';
    const r = Validator.validateForm(data);
    assertNoError(r, 'recipientCity', 'recipientCity alias mora delovati');
});

// ─── Povzetek ────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════');
if (failed > 0) {
    console.log(`  NAPAKA: ${failed}/${passed + failed} testov NEUSPEŠNIH!`);
    process.exit(1);
} else {
    console.log(`  OK: Vseh ${passed} Validator testov uspešno!`);
}
console.log('═══════════════════════════════════════\n');
