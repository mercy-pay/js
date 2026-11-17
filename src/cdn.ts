/** The script-tag build: `window.MercyPay.embedCheckout(...)`. */
import { DEFAULT_BASE_URL, embedCheckout, embedUrl } from './index.js';

(window as unknown as { MercyPay: unknown }).MercyPay = { embedCheckout, embedUrl, DEFAULT_BASE_URL };
