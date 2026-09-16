import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Utils } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PT = 2.83464566929;
function mm(v) { return v * PT; }

function _rgb(r, g, b) {
    return rgb(r / 255, g / 255, b / 255);
}

export const PdfBuilder = {
    async _preparePdf() {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        let myriadFont;
        try {
            const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Myriad Pro Semibold.ttf');
            const myriadBytes = fs.readFileSync(fontPath);
            myriadFont = await pdfDoc.embedFont(myriadBytes);
        } catch (e) {
            console.warn('Could not load Myriad Pro TTF, falling back to Helvetica Bold', e.message);
            myriadFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        }

        const courier = await pdfDoc.embedFont(StandardFonts.Courier);
        const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        return {
            pdfDoc,
            fonts: { myriad: myriadFont, courier, courierBold, helveticaBold }
        };
    },

    async _drawUPN(page, ox, oy, fonts, pageHeight, pdfDoc, s, qrBase64) {
        // Colors
        const C = {
            p172: _rgb(250, 70, 22),
            p172u: _rgb(240, 94, 61),
            p116u: _rgb(246, 183, 82),
            black: _rgb(0, 0, 0),
            bgTop: _rgb(254, 228, 220),
            bgBottom: _rgb(255, 245, 204),
            white: _rgb(255, 255, 255)
        };

        const lc = C.p172;
        const rc = C.p172u;

        // Coord transformers
        const px = (x) => mm(ox + x);
        const py = (y) => pageHeight - mm(oy + y);

        // Drawing primitives
        const line = (x1, y1, x2, y2, color, width = 0.1, dashArray = undefined) => {
            page.drawLine({
                start: { x: px(x1), y: py(y1) },
                end: { x: px(x2), y: py(y2) },
                thickness: width * PT,
                color: color,
                dashArray: dashArray ? dashArray.map(d => d * PT) : undefined
            });
        };

        const rect = (x, y, w, h, fillCol, strokeCol, width = 0.18) => {
            page.drawRectangle({
                x: px(x),
                y: py(y + h), // Bottom Y
                width: mm(w),
                height: mm(h),
                color: fillCol,
                borderColor: strokeCol,
                borderWidth: strokeCol ? (width * PT) : 0
            });
        };

        const label = (x, y, txt, color, size = 7) => {
            if (!txt) return;
            page.drawText(Utils.sanitizeForQr(txt), {
                x: px(x),
                y: py(y),
                size: size,
                font: fonts.myriad,
                color: color
            });
        };

        const fieldRect = (x, y, w, h, color, hasTicks = true) => {
            rect(x, y, w, h, C.white, color, 0.18);
            if (h === 5 && hasTicks) {
                const numTicks = Math.floor(w / 3.75);
                for (let i = 1; i < numTicks; i++) {
                    const tx = x + (i * 3.75);
                    line(tx, y, tx, y + 1, color, 0.1);
                    line(tx, y + h - 1, tx, y + h, color, 0.1);
                }
            }
        };

        const drawFieldDividers = (x, y, h, totalCells, interval, color) => {
            const step = 3.75;
            for (let i = interval; i < totalCells; i += interval) {
                const lx = x + (i * step);
                line(lx, y, lx, y + h, color, 0.1);
            }
        };

        const drawX = (x, y, w, h, color) => {
            line(x, y, x + w, y + h, color, 0.25);
            line(x + w, y, x, y + h, color, 0.25);
        };

        const dottedLineColor = (x1, y1, x2, y2, color) => {
            line(x1, y1, x2, y2, color, 0.1, [0.5, 0.8]);
        };

        const drawMarker = (x, y) => {
            rect(x, y, 1.5, 1.5, C.black, undefined, 0);
        };

        const fieldText = (x, y, w, h, txt, align = 'left', size = 10, weight = 'normal') => {
            if (!txt) return;
            const sText = Utils.sanitizeForQr(txt.toString());
            const font = weight === 'bold' ? fonts.courierBold : fonts.courier;

            const maxChars = Math.floor(mm(w - 1.5) / (size * 0.6));
            let dispText = sText.substring(0, maxChars);

            const y_mm = y + (h / 2) + (size * 0.3527 / 2.8);
            const textWidthStr = font.widthOfTextAtSize(dispText, size);
            const padding = mm(0.75);

            let txtX = px(x) + padding;
            if (align === 'right') {
                txtX = px(x + w) - padding - textWidthStr;
            } else if (align === 'center') {
                txtX = px(x + w / 2) - (textWidthStr / 2);
            }

            page.drawText(dispText, { x: txtX, y: py(y_mm), size, font, color: C.black });
        };

        const fieldTextMultiline = (x, y, w, h, txt, size = 9) => {
            if (!txt) return;
            const sText = Utils.sanitizeForQr(txt.toString());
            const lines = sText.split('\n');
            const padding = 0.75;
            const lineH = size * 0.3527 * 1.2;

            lines.forEach((l, i) => {
                if (i < 3) {
                    const maxChars = Math.floor(mm(w - 1.5) / (size * 0.6));
                    const dispText = l.substring(0, maxChars);
                    const baselineY_mm = y + padding + i * lineH + (size * 0.3527 * 0.8);

                    page.drawText(dispText, {
                        x: px(x + padding),
                        y: py(baselineY_mm),
                        size,
                        font: fonts.courier,
                        color: C.black
                    });
                }
            });
        };

        const fieldTextGridded = (x, y, w, h, txt, size = 10, align = 'left') => {
            if (!txt) return;
            const sText = Utils.sanitizeForQr(txt.toString());
            const chars = sText.split('');
            const step = 3.75;
            const maxCells = Math.floor(w / step);
            const y_mm = y + (h / 2) + (size * 0.3527 / 2.8);
            const font = fonts.courier;

            const realChars = chars.filter(c => c !== '.' && c !== ',');
            let startInx = 0;
            if (align === 'right') {
                startInx = Math.max(0, maxCells - realChars.length);
            }

            let cellIdx = 0;
            chars.forEach((char) => {
                const isSep = (char === '.' || char === ',');
                const textW = font.widthOfTextAtSize(char, size);

                if (isSep) {
                    const boundaryIdx = startInx + cellIdx;
                    if (boundaryIdx >= 0 && boundaryIdx <= maxCells) {
                        const xP = px(x + boundaryIdx * step) - (textW / 2);
                        page.drawText(char, { x: xP, y: py(y_mm), size, font, color: C.black });
                    }
                } else {
                    const currentCell = startInx + cellIdx;
                    if (currentCell >= 0 && currentCell < maxCells) {
                        const xP = px(x + currentCell * step + step / 2) - (textW / 2);
                        page.drawText(char, { x: xP, y: py(y_mm), size, font, color: C.black });
                    }
                    cellIdx++;
                }
            });
        };

        const fmtAmount = val => Utils.formatAmountForDisplay(val);
        const fmtDate = val => Utils.formatDateForQr(val);

        // Background & Structure
        rect(0, 0, 60, 99, C.white);
        rect(60, 0, 150, 55, C.bgTop);
        rect(60, 55, 150, 44, C.bgBottom);
        dottedLineColor(60, 0, 60, 99, C.black);

        drawMarker(61, 1);
        drawMarker(207.5, 1);
        drawMarker(207.5, 96.5);

        // POTRDILO (LEVI DEL)
        const dataS = 10;

        label(32.6, 4.5, 'UPN QR - potrdilo', C.black, 9);
        label(4, 5.5, 'Ime plačnika', lc);

        fieldRect(4, 6, 52.5, 13.5, lc);
        fieldTextMultiline(4, 6, 52.5, 13.5, `${s.payerName || ''}\n${s.payerAddress || ''}\n${s.payerPlace || ''}`, dataS);

        label(4, 22, 'Namen in rok plačila', lc);
        fieldRect(4, 22.5, 52.5, 9, lc);
        const fDue = fmtDate(s.dueDate);
        fieldTextMultiline(4, 22.5, 52.5, 9, `${s.purpose || ''}${(s.purpose && fDue) ? ', ' : ''}${fDue}`, dataS);

        label(16.5, 34, 'Znesek', lc);
        label(7.8, 38.5, (s.currency || 'EUR').toUpperCase(), C.black, 11);
        fieldRect(16.5, 34.5, 40, 5, lc, false);
        fieldText(16.5, 34.5, 40, 5, fmtAmount(s.amount), 'right', dataS);

        label(4, 42, 'IBAN in referenca prejemnika', lc);
        fieldRect(4, 42.5, 52.5, 13.5, lc);
        fieldTextMultiline(4, 42.5, 52.5, 13.5, `${(s.recipientIban || '').toUpperCase()}\n${s.recipientRefCode || ''}${s.recipientRef || ''}`, dataS);

        label(4, 58.5, 'Ime prejemnika', lc);
        fieldRect(4, 59, 52.5, 13.5, lc);
        fieldTextMultiline(4, 59, 52.5, 13.5, `${s.recipientName || ''}\n${s.recipientAddress || ''}\n${s.recipientPlace || ''}`, dataS);

        label(13.8, 97, 'Prostor za vpise ponudnika plačilnih storitev', lc, 5);

        // NALOG (DESNI DEL)
        const rDataS = 10;

        label(63.5, 5.5, 'Koda QR', rc);
        rect(63.5, 6, 40, 39.5, C.white, rc); 

        // A21
        const a21w = 0.6;
        const a21t = 0.25; 
        rect(63.5, 7.8, a21w, a21t, rc);            
        rect(102.9, 7.8, a21w, a21t, rc);           
        rect(63.5, 43.7, a21w, a21t, rc);           
        rect(102.9, 43.7, a21w, a21t, rc);          
        rect(65.3, 6.0, a21t, a21w, rc);            
        rect(101.7, 6.0, a21t, a21w, rc);           
        rect(65.3, 44.9, a21t, a21w, rc);           
        rect(101.7, 44.9, a21t, a21w, rc);          

        // Embed QR code if provided
        if (qrBase64) {
            try {
                const imageObj = await pdfDoc.embedPng(qrBase64);
                page.drawImage(imageObj, {
                    x: px(65.3),
                    y: py(7.8 + 35.9),
                    width: mm(35.9),
                    height: mm(35.9)
                });
            } catch (e) {
                console.warn('QR embed failed', e);
            }
        }

        label(106.5, 5.5, 'IBAN plačnika', rc);
        fieldRect(106.5, 6, 71.25, 5, rc);
        drawFieldDividers(106.5, 6, 5, 19, 4, rc);
        fieldTextGridded(106.5, 6, 71.25, 5, s.payerIban ? s.payerIban.replace(/\s/g, '').toUpperCase() : '', rDataS);

        label(184.3, 5.5, 'Polog', rc);
        label(196.1, 5.5, 'Dvig', rc);

        fieldRect(185.2, 6.5, 4, 4, rc);
        drawX(185.2, 6.5, 4, 4, rc);
        if (s.polog) fieldText(185.2, 6.5, 4, 4, 'X', 'center', 11, 'bold');

        fieldRect(196.5, 6.5, 4, 4, rc);
        drawX(196.5, 6.5, 4, 4, rc);
        if (s.dvig) fieldText(196.5, 6.5, 4, 4, 'X', 'center', 11, 'bold');

        label(106.5, 13.5, 'Referenca plačnika', rc);
        fieldRect(106.5, 14, 15, 5, rc);
        fieldTextGridded(106.5, 14, 15, 5, s.payerRefCode, rDataS);
        fieldRect(123.5, 14, 82.5, 5, rc);
        fieldTextGridded(123.5, 14, 82.5, 5, s.payerRef, rDataS);

        label(106.5, 21.5, 'Ime, ulica in kraj plačnika', rc);
        fieldRect(106.5, 22, 99.5, 15, rc);
        fieldText(106.5, 22, 99.5, 5, s.payerName, 'left', rDataS);
        dottedLineColor(106.5, 27, 206, 27, rc);
        fieldText(106.5, 27, 99.5, 5, s.payerAddress, 'left', rDataS);
        dottedLineColor(106.5, 32, 206, 32, rc);
        fieldText(106.5, 32, 99.5, 5, s.payerPlace, 'left', rDataS);

        label(114.2, 40, 'Znesek', rc);
        label(106.5, 44.5, (s.currency || 'EUR').toUpperCase(), C.black, 11);
        fieldRect(114.2, 40.5, 41.25, 5, rc);
        drawFieldDividers(114.2, 40.5, 5, 11, 3, rc);

        const amtChW = 3 * 3.75;
        for (let i = 1; i <= 3; i++) {
            const lx = 114.2 + i * amtChW;
            if (i === 3) {
                rect(lx - 0.4, 44.3, 0.8, 1.2, rc);
                page.drawText(',', { x: px(lx - 0.25), y: py(45.0), size: 5, font: fonts.helveticaBold, color: C.white });
            } else {
                rect(lx - 0.4, 44.7, 0.8, 0.8, rc);
            }
        }

        fieldTextGridded(114.2, 40.5, 41.25, 5, fmtAmount(s.amount), dataS, 'right');

        label(161.2, 40, 'Datum plačila', rc);
        fieldRect(161.2, 40.5, 30, 5, rc);
        drawFieldDividers(161.2, 40.5, 5, 8, 2, rc);

        const dateChW = 2 * 3.75;
        for (let i = 1; i <= 2; i++) {
            rect(161.2 + i * dateChW - 0.4, 44.7, 0.8, 0.8, rc);
        }

        fieldTextGridded(161.2, 40.5, 30, 5, fmtDate(s.paymentDate), dataS);

        label(195.3, 40, 'Nujno', rc);
        fieldRect(196.5, 41, 4, 4, rc);
        drawX(196.5, 41, 4, 4, rc);
        if (s.urgent) fieldText(196.5, 41, 4, 4, 'X', 'center', 11, 'bold');

        label(63.5, 48.5, 'Koda namena', rc);
        label(80.5, 48.5, 'Namen plačila', rc);
        label(176.2, 48.5, 'Rok plačila', rc);

        fieldRect(63.5, 49, 15, 5, rc);
        fieldTextGridded(63.5, 49, 15, 5, s.purposeCode, rDataS);

        fieldRect(80.5, 49, 93.75, 5, rc);
        fieldTextGridded(80.5, 49, 93.75, 5, s.purpose, rDataS);

        fieldRect(176.2, 49, 29.75, 5, rc);
        drawFieldDividers(176.2, 49, 5, 8, 2, rc);

        for (let i = 1; i <= 2; i++) {
            rect(176.2 + i * dateChW - 0.4, 53.2, 0.8, 0.8, rc);
        }

        fieldTextGridded(176.2, 49, 29.75, 5, fmtDate(s.dueDate), dataS);

        label(63.5, 57.5, 'IBAN prejemnika', rc);
        fieldRect(63.5, 58, 127.5, 5, rc);
        drawFieldDividers(63.5, 58, 5, 34, 4, rc);
        fieldTextGridded(63.5, 58, 127.5, 5, s.recipientIban ? s.recipientIban.replace(/\s/g, '').toUpperCase() : '', rDataS);

        label(194.3, 61.5, 'UPN QR', C.black, 10);
        label(63.5, 65.5, 'Referenca prejemnika', rc);
        fieldRect(63.5, 66, 15, 5, rc);
        fieldTextGridded(63.5, 66, 15, 5, s.recipientRefCode, rDataS);
        fieldRect(80.5, 66, 82.5, 5, rc);
        fieldTextGridded(80.5, 66, 82.5, 5, s.recipientRef, rDataS);

        fieldRect(166, 66, 40, 23, rc);
        line(168.6, 85.3, 203.6, 85.3, rc);
        label(172, 88, 'Podpis plačnika (neobvezno žig)', rc, 5);

        label(63.5, 73.5, 'Ime, ulica in kraj prejemnika', rc);
        fieldRect(63.5, 74, 99.5, 15, rc);
        fieldText(63.5, 74, 99.5, 5, s.recipientName, 'left', rDataS);
        dottedLineColor(63.5, 79, 163, 79, rc);
        fieldText(63.5, 79, 99.5, 5, s.recipientAddress, 'left', rDataS);
        dottedLineColor(63.5, 84, 163, 84, rc);
        fieldText(63.5, 84, 99.5, 5, s.recipientPlace, 'left', rDataS);

        label(118.9, 97, 'Prostor za vpise ponudnika plačilnih storitev', rc, 5);
    },

    /**
     * Generates a UPN PDF buffer.
     * @param {Object} data - UPN data.
     * @param {Object} options - { format: 'exact' | 'a4', qrBase64: string }
     * @returns {Promise<Uint8Array>}
     */
    async generateUpnPdf(data, options = { format: 'exact' }) {
        const { pdfDoc, fonts } = await this._preparePdf();
        const pageHeightMm = options.format === 'a4' ? 297 : 99;
        const page = pdfDoc.addPage([mm(210), mm(pageHeightMm)]);

        const ox = 0;
        const oy = options.format === 'a4' ? 198 : 0; 

        await this._drawUPN(page, ox, oy, fonts, mm(pageHeightMm), pdfDoc, data, options.qrBase64);

        return await pdfDoc.save();
    },

    /**
     * Generates a batch UPN PDF buffer containing multiple pages (merged).
     * @param {Array<Object>} dataArray - Array of UPN data objects.
     * @param {Object} options - { format: 'exact' | 'a4', qrBase64Array: Array<string> }
     * @returns {Promise<Uint8Array>}
     */
    async generateBatchPdf(dataArray, options = { format: 'exact' }) {
        const { pdfDoc, fonts } = await this._preparePdf();
        const pageHeightMm = options.format === 'a4' ? 297 : 99;
        
        for (let i = 0; i < dataArray.length; i++) {
            const data = dataArray[i];
            const qrBase64 = options.qrBase64Array ? options.qrBase64Array[i] : undefined;
            
            const page = pdfDoc.addPage([mm(210), mm(pageHeightMm)]);
            const ox = 0;
            const oy = options.format === 'a4' ? 198 : 0; 
            
            await this._drawUPN(page, ox, oy, fonts, mm(pageHeightMm), pdfDoc, data, qrBase64);
        }

        return await pdfDoc.save();
    }
};
