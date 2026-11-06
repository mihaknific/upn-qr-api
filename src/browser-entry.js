import fontkit from '@pdf-lib/fontkit';
import myriadFontUrl from '../assets/fonts/Myriad Pro Semibold.ttf';
import { initializeTester } from '../pages/app.js';
import { PdfBuilder } from './core/pdf-builder.js';
import { QrGenerator } from './core/qr-generator.js';
import { Validator } from './core/validator.js';

const myriadFontBytes = Uint8Array.from(
    atob(myriadFontUrl.split(',')[1]),
    character => character.charCodeAt(0)
);

initializeTester({ PdfBuilder, QrGenerator, Validator, fontkit, fontBytes: myriadFontBytes });
