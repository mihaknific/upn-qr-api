# UPN QR API

Profesionalen in zmogljiv Node.js (Fastify) API za generiranje slovenskih plačilnih nalogov UPN QR (standard ZBS). Arhitektura je pripravljena za visoko zmogljivost in enostavno Docker produkcijo.

## Funkcionalnosti
- **Visoka zmogljivost:** Zasnovano na arhitekturi Fastify.
- **Nativen PDF Builder:** Vsebuje modul `pdf-lib` za grajenje PDF datotek brez brskalnika ali DOM operacij.
- **Batch procesiranje:** Zmožnost združevanja več sto nalogov v posamezno ZIP ali enotno (merged) PDF datoteko z enim API klicem.
- **Striktna validacija:** Integrirana JSON Schema (ajv) za takojšnjo obravnavo neveljavnih parametrov.
- **Varnost:** Rate limiting (100 klicev/min) in avtentikacija z API ključi (Bearer Token).

## Namestitev in zagon

**Lokalni zagon (Node.js)**
```bash
npm install
npm run start
```
*API bo na voljo na `http://localhost:3000`*

**Zagon preko Dockerja**
```bash
docker build -t upn-qr-api .
docker run -p 3000:3000 -e API_KEY=moj_super_kljuc upn-qr-api
```

## API Endpointi

Vsi API klici zahtevajo glavo:
`Authorization: Bearer dev_secret_key_2026` *(ali vrednost vaše spremenljivke `API_KEY`)*

### GET `/api/health`
Preveri, ali je strežnik aktiven. Ne zahteva avtentikacije.

### POST `/api/pdf` (in `/api/pdf/a4`)
Sprejme JSON s podatki o nalogu in vrne binarno PDF datoteko. `/api/pdf/a4` izriše nalog na spodnjem robu A4 lista.

**Primer JSON strukture:**
```json
{
  "amount": "150.00",
  "payerName": "JANEZ NOVAK",
  "payerAddress": "SLOVENSKA 1",
  "payerPlace": "1000 LJUBLJANA",
  "recipientName": "PODJETJE D.O.O.",
  "recipientIban": "SI56020170014356205",
  "recipientRefCode": "SI00",
  "recipientRef": "1234",
  "purposeCode": "OTHR",
  "purpose": "TESTNO PLACILO",
  "paymentDate": "2026-06-01"
}
```

### POST `/api/batch`
Omogoča generiranje do 500 nalogov hkrati.
**Parametri:**
- `nalogi`: Polje objektov (zgornja JSON struktura).
- `merge`: `true` (vrne en velik PDF) ali `false` (vrne ZIP datoteko s posameznimi PDF-ji).
- `format`: `"exact"` (210x99mm) ali `"a4"`.

### POST `/api/validate` in `/api/qr`
`/validate` vrne povzetek o veljavnosti in morebitnih opozorilih. `/qr` vrne binarno PNG sliko same UPNQR kode brez okvirja.

## Primeri klicanja iz drugih aplikacij

### 1. cURL (Terminal / Bash)
```bash
curl -X POST http://localhost:3000/api/pdf \
  -H "Authorization: Bearer dev_secret_key_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "150.00",
    "payerName": "JANEZ NOVAK",
    "payerAddress": "SLOVENSKA 1",
    "payerPlace": "1000 LJUBLJANA",
    "recipientName": "PODJETJE D.O.O.",
    "recipientIban": "SI56020170014356205",
    "recipientRefCode": "SI00",
    "recipientRef": "1234",
    "purposeCode": "OTHR",
    "purpose": "TESTNO PLACILO",
    "paymentDate": "2026-06-01"
  }' \
  --output nalog.pdf
```

### 2. JavaScript / Node.js / TypeScript
```javascript
// Primer klica iz spletne, mobilne ali zaledne Node.js aplikacije
const response = await fetch('http://localhost:3000/api/pdf', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer dev_secret_key_2026',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: '150.00',
    payerName: 'JANEZ NOVAK',
    payerAddress: 'SLOVENSKA 1',
    payerPlace: '1000 LJUBLJANA',
    recipientName: 'PODJETJE D.O.O.',
    recipientIban: 'SI56020170014356205',
    recipientRefCode: 'SI00',
    recipientRef: '1234',
    purposeCode: 'OTHR',
    purpose: 'TESTNO PLACILO',
    paymentDate: '2026-06-01'
  })
});

// Prejeto binarno vsebino shranimo ali ponudimo za prenos
const pdfBuffer = await response.arrayBuffer();
```

### 3. Python (Requests)
```python
import requests

url = "http://localhost:3000/api/pdf"
headers = {
    "Authorization": "Bearer dev_secret_key_2026",
    "Content-Type": "application/json"
}
payload = {
    "amount": "150.00",
    "payerName": "JANEZ NOVAK",
    "payerAddress": "SLOVENSKA 1",
    "payerPlace": "1000 LJUBLJANA",
    "recipientName": "PODJETJE D.O.O.",
    "recipientIban": "SI56020170014356205",
    "recipientRefCode": "SI00",
    "recipientRef": "1234",
    "purposeCode": "OTHR",
    "purpose": "TESTNO PLACILO",
    "paymentDate": "2026-06-01"
}

response = requests.post(url, json=payload, headers=headers)
if response.status_code == 200:
    with open("nalog.pdf", "wb") as f:
        f.write(response.content)
    print("PDF nalog uspešno prejet in shranjen!")
```

### 4. PHP (npr. WooCommerce / spletne trgovine)
```php
<?php
$data = [
    "amount" => "150.00",
    "payerName" => "JANEZ NOVAK",
    "payerAddress" => "SLOVENSKA 1",
    "payerPlace" => "1000 LJUBLJANA",
    "recipientName" => "PODJETJE D.O.O.",
    "recipientIban" => "SI56020170014356205",
    "recipientRefCode" => "SI00",
    "recipientRef" => "1234",
    "purposeCode" => "OTHR",
    "purpose" => "TESTNO PLACILO",
    "paymentDate" => "2026-06-01"
];

$ch = curl_init("http://localhost:3000/api/pdf");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer dev_secret_key_2026",
    "Content-Type: application/json"
]);

$pdfBinary = curl_exec($ch);
curl_close($ch);

file_put_contents("nalog.pdf", $pdfBinary);
?>
```

## OpenAPI 3.0 specifikacija
V mapi [`docs/openapi.yaml`](docs/openapi.yaml) se nahaja uradna strojna OpenAPI specifikacija. Lahko jo uvozite neposredno v orodja kot so **Postman**, **Swagger Editor** ali **Insomnia** za samodejno generiranje odjemalcev in interaktivno testiranje.

## Testiranje
Za izvedbo enotnih in integracijskih testov:
```bash
npm test
```

