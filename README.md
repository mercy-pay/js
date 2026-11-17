# Mercy Pay dans le navigateur

Affichez le formulaire de paiement [Mercy Pay](https://mercy-pay.com) dans votre page : mobile money, carte bancaire avec la 3D Secure, et Apple Pay et Google Pay sur vos sites vérifiés. Aucune librairie de paiement à installer, et les données de carte ne passent jamais par votre page. Moins de 3 Ko, sans dépendance.

```sh
npm install @mercy-pay/js
```

Ou sans outil de build :

```html
<script src="https://cdn.jsdelivr.net/npm/@mercy-pay/js@0.1/dist/mercy-pay.js"></script>
```

## 1. Créez la session sur votre serveur

Avec votre clé API, jamais dans le navigateur : `POST /api/v1/checkout_sessions` avec `ui_mode: "embedded"`. Renvoyez à votre page le `client_secret` de la réponse. Voir le [guide du paiement intégré](https://docs.mercy-pay.com/payments/embedded).

Le formulaire ne s'affiche que sur vos sites déclarés et vérifiés dans **Paramètres > Paiements**. En sandbox, `localhost` marche tout de suite.

## 2. Affichez le formulaire

```html
<div id="paiement"></div>
```

```js
import { embedCheckout } from '@mercy-pay/js';
// Par le CDN : const { embedCheckout } = window.MercyPay;

const checkout = embedCheckout({
  clientSecret,
  appearance: { theme: 'light', color: '#1a7f37', radius: 12 },
  onSuccess: () => {
    window.location.href = '/commande/4821/merci';
  },
  onFailure: (event) => console.log(event.message),
  onError: () => {
    // Session introuvable ou expirée : créez-en une nouvelle.
  },
}).mount('#paiement');

// Plus tard, si vous changez de page sans recharger :
checkout.destroy();
```

L'iframe suit la hauteur du formulaire. `autoResize: false` la laisse à votre charge.

## Options

| Option | Rôle |
| --- | --- |
| `clientSecret` | Le `client_secret` de la session, obligatoire. |
| `appearance` | `theme` (`light` ou `dark`), `color` (hexadécimal), `radius` (0 à 24). Par défaut, votre Image de marque. |
| `onReady` | Le formulaire est affiché. |
| `onProcessing` | Le paiement est lancé : le client valide sur son téléphone ou auprès de sa banque. |
| `onSuccess` | Le paiement a réussi, avec `payment` et `checkout_session`. |
| `onFailure` | Le paiement a échoué. Le client peut réessayer dans le formulaire. |
| `onExpired` | La session a expiré. |
| `onError` | Le formulaire ne peut pas s'ouvrir (`code: "session_unavailable"`). |
| `onEvent` | Chaque message, redimensionnement compris. |

Seuls les messages venant de mercy-pay.com, et de cet iframe-là, sont pris en compte.

## Confirmez sur votre serveur

`onSuccess` sert à mettre à jour votre page. Il ne prouve rien : confirmez la commande quand votre serveur reçoit le webhook `payment.succeeded`, signé.

## Licence

MIT
