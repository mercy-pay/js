import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedCheckout, embedUrl } from '../src/index.js';

const SECRET = `cs_${'0'.repeat(26)}_secret_${'a'.repeat(32)}`;

afterEach(() => {
  document.body.innerHTML = '';
});

function post(iframe: HTMLIFrameElement | null, data: unknown, origin = 'https://mercy-pay.com'): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source: iframe?.contentWindow ?? null }));
}

describe('embedUrl', () => {
  it('builds the form address with the appearance it understands, and drops the rest', () => {
    const url = new URL(embedUrl(SECRET, { theme: 'dark', color: '#1A7F37', radius: 40 }));

    expect(url.origin + url.pathname).toBe('https://mercy-pay.com/integre/v1/paiement');
    expect(url.searchParams.get('client_secret')).toBe(SECRET);
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.get('color')).toBe('1a7f37');
    expect(url.searchParams.get('radius')).toBe('24');
    expect(new URL(embedUrl(SECRET, { color: 'red' })).searchParams.has('color')).toBe(false);
  });

  it('refuses anything that is not a session client secret, before any request', () => {
    expect(() => embedUrl('mp_sandbox_123')).toThrow(/clientSecret invalide/);
  });
});

describe('embedCheckout', () => {
  it('mounts one iframe that may show Apple Pay and Google Pay, and says which page hosts it', () => {
    document.body.innerHTML = '<div id="paiement"></div>';

    const checkout = embedCheckout({ clientSecret: SECRET }).mount('#paiement');
    const iframe = document.querySelector('#paiement iframe') as HTMLIFrameElement;

    expect(checkout.iframe).toBe(iframe);
    expect(iframe.allow).toBe('payment');
    expect(new URL(iframe.src).searchParams.get('origin')).toBe(window.location.origin);
    expect(() => checkout.mount('#paiement')).toThrow(/déjà affiché/);
  });

  it('follows the form height and calls the right callback for each event', () => {
    document.body.innerHTML = '<div id="paiement"></div>';
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onError = vi.fn();
    const onEvent = vi.fn();
    const checkout = embedCheckout({ clientSecret: SECRET, onSuccess, onFailure, onError, onEvent }).mount('#paiement');

    post(checkout.iframe, { source: 'mercy-pay', version: 1, type: 'resize', height: 612.4 });
    post(checkout.iframe, { source: 'mercy-pay', version: 1, type: 'payment_failed', checkout_session: 'cs_1', payment: 'pay_1', message: 'Solde insuffisant.' });
    post(checkout.iframe, { source: 'mercy-pay', version: 1, type: 'payment_succeeded', checkout_session: 'cs_1', payment: 'pay_2' });
    post(checkout.iframe, { source: 'mercy-pay', version: 1, type: 'error', code: 'session_unavailable' });

    expect(checkout.iframe?.style.height).toBe('613px');
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ message: 'Solde insuffisant.' }));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ payment: 'pay_2' }));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'session_unavailable' }));
    expect(onEvent).toHaveBeenCalledTimes(4);
  });

  it('ignores messages from another origin, another frame or another sender', () => {
    document.body.innerHTML = '<div id="paiement"></div><iframe id="autre"></iframe>';
    const onSuccess = vi.fn();
    const checkout = embedCheckout({ clientSecret: SECRET, onSuccess }).mount('#paiement');
    const other = document.getElementById('autre') as HTMLIFrameElement;
    const succeeded = { source: 'mercy-pay', type: 'payment_succeeded', checkout_session: 'cs_1', payment: 'pay_1' };

    post(checkout.iframe, succeeded, 'https://pirate.example');
    post(other, succeeded);
    post(checkout.iframe, { ...succeeded, source: 'autre-chose' });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('removes the form and stops listening on destroy', () => {
    document.body.innerHTML = '<div id="paiement"></div>';
    const onSuccess = vi.fn();
    const checkout = embedCheckout({ clientSecret: SECRET, onSuccess }).mount('#paiement');
    const iframe = checkout.iframe;

    checkout.destroy();
    post(iframe, { source: 'mercy-pay', type: 'payment_succeeded', checkout_session: 'cs_1', payment: 'pay_1' });

    expect(document.querySelector('iframe')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
