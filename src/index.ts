/**
 * Mercy Pay in the browser: shows the payment form in your page, inside an iframe served by
 * Mercy Pay. Card data never touches your page, and no payment library is loaded in it.
 */

export const DEFAULT_BASE_URL = 'https://mercy-pay.com';

const CLIENT_SECRET = /^cs_[0-9A-Za-z]{26}_secret_[0-9A-Za-z]{32}$/;

export interface Appearance {
  /** Forces the light or dark theme. Without it, the form follows the customer's device. */
  theme?: 'light' | 'dark';
  /** The main color, in hex: `#1a7f37` or `1a7f37`. */
  color?: string;
  /** Corner radius of fields and buttons, from 0 to 24 pixels. */
  radius?: number;
}

export interface ReadyEvent {
  type: 'ready';
  checkout_session: string;
}

export interface ProcessingEvent {
  type: 'processing';
  checkout_session: string;
  payment: string | null;
}

export interface SucceededEvent {
  type: 'payment_succeeded';
  checkout_session: string;
  payment: string | null;
}

export interface FailedEvent {
  type: 'payment_failed';
  checkout_session: string;
  payment: string | null;
  message: string | null;
}

export interface ExpiredEvent {
  type: 'expired';
  checkout_session: string;
}

export interface ResizeEvent {
  type: 'resize';
  height: number;
}

/** The form can't open: a wrong secret, or a session that no longer exists. Create a new one. */
export interface CheckoutErrorEvent {
  type: 'error';
  code: 'session_unavailable' | (string & {});
}

export type CheckoutEvent = ReadyEvent | ProcessingEvent | SucceededEvent | FailedEvent | ExpiredEvent | ResizeEvent | CheckoutErrorEvent;

export interface EmbedCheckoutOptions {
  /** The `client_secret` of a checkout session created with `ui_mode: "embedded"`, on your server. */
  clientSecret: string;
  appearance?: Appearance;
  /** Follows the form's height, so it never scrolls inside your page. `true` by default. */
  autoResize?: boolean;
  onReady?: (event: ReadyEvent) => void;
  onProcessing?: (event: ProcessingEvent) => void;
  /** Updates your page. Confirm the order on your server, with the `payment.succeeded` webhook. */
  onSuccess?: (event: SucceededEvent) => void;
  /** The customer can try again in the form. */
  onFailure?: (event: FailedEvent) => void;
  onExpired?: (event: ExpiredEvent) => void;
  onError?: (event: CheckoutErrorEvent) => void;
  /** Every event, resize included, before its own callback. */
  onEvent?: (event: CheckoutEvent) => void;
  /** @internal Another Mercy Pay address, for tests. */
  baseUrl?: string;
}

export interface EmbeddedCheckout {
  /** Puts the form in this element, or the first one matching this selector. */
  mount: (target: string | HTMLElement) => EmbeddedCheckout;
  /** Removes the form and stops listening. */
  destroy: () => void;
  /** The iframe, once mounted. */
  readonly iframe: HTMLIFrameElement | null;
}

/** The form's address. Throws on a value that can't be a client secret, before any request. */
export function embedUrl(clientSecret: string, appearance: Appearance = {}, baseUrl: string = DEFAULT_BASE_URL): string {
  if (!CLIENT_SECRET.test(String(clientSecret))) {
    throw new Error('Mercy Pay : clientSecret invalide. Passez le client_secret d\'une session créée avec ui_mode "embedded".');
  }

  const url = new URL('/integre/v1/paiement', baseUrl);
  url.searchParams.set('client_secret', clientSecret);

  if (appearance.theme === 'light' || appearance.theme === 'dark') {
    url.searchParams.set('theme', appearance.theme);
  }

  const color = appearance.color?.replace(/^#/, '');
  if (color && /^[0-9a-fA-F]{6}$/.test(color)) {
    url.searchParams.set('color', color.toLowerCase());
  }

  if (typeof appearance.radius === 'number' && Number.isFinite(appearance.radius)) {
    url.searchParams.set('radius', String(Math.min(24, Math.max(0, Math.round(appearance.radius)))));
  }

  return url.toString();
}

/**
 * ```js
 * const checkout = embedCheckout({
 *   clientSecret,
 *   onSuccess: () => (window.location.href = '/merci'),
 * }).mount('#paiement');
 * ```
 */
export function embedCheckout(options: EmbedCheckoutOptions): EmbeddedCheckout {
  const src = embedUrl(options.clientSecret, options.appearance, options.baseUrl);
  const origin = new URL(src).origin;
  let iframe: HTMLIFrameElement | null = null;

  const onMessage = (message: MessageEvent): void => {
    // Only our own frame: another tab, script or embed on the page can't pose as it.
    if (iframe === null || message.origin !== origin || message.source !== iframe.contentWindow) {
      return;
    }

    const data = message.data as Record<string, unknown> | null;
    if (data === null || typeof data !== 'object' || data.source !== 'mercy-pay' || typeof data.type !== 'string') {
      return;
    }

    const event = data as unknown as CheckoutEvent;
    options.onEvent?.(event);

    switch (event.type) {
      case 'resize':
        if (options.autoResize !== false && typeof event.height === 'number' && event.height > 0) {
          iframe.style.height = `${Math.ceil(event.height)}px`;
        }
        break;
      case 'ready':
        options.onReady?.(event);
        break;
      case 'processing':
        options.onProcessing?.(event);
        break;
      case 'payment_succeeded':
        options.onSuccess?.(event);
        break;
      case 'payment_failed':
        options.onFailure?.(event);
        break;
      case 'expired':
        options.onExpired?.(event);
        break;
      case 'error':
        options.onError?.(event);
        break;
    }
  };

  const checkout: EmbeddedCheckout = {
    get iframe() {
      return iframe;
    },
    mount(target) {
      if (iframe !== null) {
        throw new Error('Mercy Pay : ce formulaire est déjà affiché. Appelez destroy() avant de le remonter.');
      }

      const container = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
      if (!container) {
        throw new Error(`Mercy Pay : élément introuvable (${String(target)}).`);
      }

      iframe = document.createElement('iframe');
      // Says which page hosts the form, for a site that sends no Referer. Mercy Pay only
      // trusts it for the shop's own verified sites.
      const withOrigin = new URL(src);
      withOrigin.searchParams.set('origin', window.location.origin);
      iframe.src = withOrigin.toString();
      iframe.title = 'Paiement';
      // Apple Pay and Google Pay need it inside a frame.
      iframe.allow = 'payment';
      iframe.style.cssText = 'display:block;width:100%;min-height:320px;height:520px;border:0;background:transparent';

      window.addEventListener('message', onMessage);
      container.appendChild(iframe);

      return checkout;
    },
    destroy() {
      window.removeEventListener('message', onMessage);
      iframe?.remove();
      iframe = null;
    },
  };

  return checkout;
}
