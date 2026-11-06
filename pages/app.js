export function initializeTester({ PdfBuilder, QrGenerator, Validator, fontkit, fontBytes }) {
    const form = document.getElementById('paymentForm');
    const message = document.getElementById('message');
    const empty = document.querySelector('.empty');
    const pdfPreview = document.getElementById('pdfPreview');
    const qrPreview = document.getElementById('qrPreview');
    const download = document.getElementById('download');
    let currentPdfUrl;

    function localDateValue() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    document.getElementById('paymentDate').value = localDateValue();

    function getData() {
        const data = Object.fromEntries(new FormData(form).entries());
        data.urgent = document.getElementById('urgent').checked;
        if (!data.dueDate) delete data.dueDate;
        return data;
    }

    function report(text, type = '') {
        message.textContent = text;
        message.className = `message ${type}`.trim();
    }

    function clearDownload() {
        download.hidden = true;
        download.removeAttribute('href');
        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
            currentPdfUrl = undefined;
        }
    }

    function showQr(dataUrl, filename) {
        clearDownload();
        empty.hidden = true;
        pdfPreview.hidden = true;
        pdfPreview.removeAttribute('src');
        qrPreview.src = dataUrl;
        qrPreview.hidden = false;
        download.href = dataUrl;
        download.download = filename;
        download.textContent = 'Prenesi QR kodo (PNG)';
        download.hidden = false;
    }

    function validateUpn(data) {
        const { errors, warnings } = Validator.validateForm(data);
        if (errors.length) {
            report(errors.map(error => error.msg).join(' '), 'error');
            return false;
        }
        if (warnings.length) report(warnings.map(warning => warning.msg).join(' '));
        return true;
    }

    async function run(button, action) {
        button.disabled = true;
        try {
            await action();
        } catch (error) {
            report(error.message || 'Pri ustvarjanju je prišlo do napake.', 'error');
        } finally {
            button.disabled = false;
        }
    }

    document.getElementById('generateUpnQr').addEventListener('click', event => run(event.currentTarget, async () => {
        const data = getData();
        if (!validateUpn(data)) return;
        const image = await QrGenerator.generateImage(data, { format: 'png', type: 'upn' });
        showQr(image, 'upn-qr.png');
        report('UPN QR koda je ustvarjena. Podatki so ostali v tem brskalniku.', 'success');
    }));

    document.getElementById('generateEpcQr').addEventListener('click', event => run(event.currentTarget, async () => {
        const data = getData();
        const image = await QrGenerator.generateImage(data, { format: 'png', type: 'epc' });
        showQr(image, 'sepa-epc-qr.png');
        report('SEPA EPC QR koda je ustvarjena. Podatki so ostali v tem brskalniku.', 'success');
    }));

    document.getElementById('generatePdf').addEventListener('click', event => run(event.currentTarget, async () => {
        const data = getData();
        if (!validateUpn(data)) return;
        const qr = await QrGenerator.generateImage(data, { format: 'png', type: 'upn' });
        const format = document.getElementById('pdfFormat').value;
        const bytes = await PdfBuilder.generateUpnPdf(data, { format, qrBase64: qr, fontkit, fontBytes });
        clearDownload();
        const pdf = new Blob([bytes], { type: 'application/pdf' });
        currentPdfUrl = URL.createObjectURL(pdf);
        empty.hidden = true;
        qrPreview.hidden = true;
        qrPreview.removeAttribute('src');
        pdfPreview.src = currentPdfUrl;
        pdfPreview.hidden = false;
        download.href = currentPdfUrl;
        download.download = `upn-nalog-${format}.pdf`;
        download.textContent = 'Prenesi PDF';
        download.hidden = false;
        report('PDF nalog je ustvarjen. Pred tiskanjem preverite merilo in podatke.', 'success');
    }));
}
