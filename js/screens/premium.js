/* =========================================================
   DAR AL LOUGHAH — SCREEN: PREMIUM
   - Page d'abonnement Premium
   - 4 méthodes de paiement (Stripe/PayPal/Apple/Google)
   - Codes cadeau / promo
   - État dynamique (premium déjà actif ?)
   ========================================================= */

const PremiumScreen = (function() {

  /* =========================================================
     SHOW
     ========================================================= */
  function show() {
    refreshPriceDisplay();
    refreshState();
    setupPaymentButtons();
  }

  /* =========================================================
     PRIX
     ========================================================= */
  function refreshPriceDisplay() {
    const price = (window.CONFIG && window.CONFIG.PREMIUM_PRICE) || 7.99;
    const currency = (window.CONFIG && window.CONFIG.PREMIUM_CURRENCY) || "€";
    const formatted = price.toString().replace(".", ",") + currency;

    document.querySelectorAll('[data-bind="premium-price"]').forEach(function(el) {
      el.textContent = formatted;
    });
  }

  /* =========================================================
     ÉTAT DYNAMIQUE (déjà premium ou non ?)
     ========================================================= */
  function refreshState() {
    const isPremium = window.State && window.State.get("isPremium");

    // Désactiver les boutons de paiement si déjà Premium
    const payButtons = document.querySelectorAll(".pay-btn");
    payButtons.forEach(function(btn) {
      btn.disabled = isPremium;
      btn.style.opacity = isPremium ? "0.5" : "";
      btn.style.cursor = isPremium ? "not-allowed" : "pointer";
    });

    // Champ code cadeau
    const giftInput = document.getElementById("giftCode");
    if (giftInput) {
      giftInput.disabled = isPremium;
      giftInput.placeholder = isPremium ? "✦ Premium déjà actif" : "Code cadeau / promo";
    }

    // Si Premium actif, ajouter une bannière
    showPremiumActiveBanner(isPremium);
  }

  function showPremiumActiveBanner(isPremium) {
    const existingBanner = document.getElementById("premiumActiveBanner");

    if (isPremium) {
      if (!existingBanner) {
        const banner = document.createElement("div");
        banner.id = "premiumActiveBanner";
        banner.style.cssText =
          "padding: 14px 16px; margin: 12px 0;" +
          "background: linear-gradient(180deg, rgba(244,215,122,.2), rgba(212,175,55,.1));" +
          "border: 1px solid var(--gold-light);" +
          "border-radius: 14px; text-align: center;" +
          "font-family: 'Cinzel', serif; font-size: 14px;" +
          "color: var(--gold-light); letter-spacing: 1.5px;";
        banner.innerHTML = '✦ PREMIUM ACTIVÉ — MERCI ✦';

        const heroEl = document.querySelector("#screen-premium .premium-hero");
        if (heroEl && heroEl.parentNode) {
          heroEl.parentNode.insertBefore(banner, heroEl.nextSibling);
        }
      }
    } else if (existingBanner) {
      existingBanner.remove();
    }
  }

  /* =========================================================
     CONFIGURE LES BOUTONS DE PAIEMENT
     ========================================================= */
  function setupPaymentButtons() {
    if (window.Payments && window.Payments.setupPaymentButtons) {
      window.Payments.setupPaymentButtons();
    }
  }

  /* =========================================================
     ACTIONS DE PAIEMENT
     ========================================================= */
  function payStripe() {
    if (!window.Payments) return;
    const result = window.Payments.payWithStripe();
    handlePaymentResult(result);
  }

  function payPayPal() {
    if (!window.Payments) return;
    const result = window.Payments.payWithPayPal();
    handlePaymentResult(result);
  }

  function payApple() {
    if (!window.Payments) return;
    const result = window.Payments.payWithApple();
    handlePaymentResult(result);
  }

  function payGoogle() {
    if (!window.Payments) return;
    const result = window.Payments.payWithGoogle();
    handlePaymentResult(result);
  }

  function handlePaymentResult(result) {
    if (!result) return;
    if (result.message && window.Main && window.Main.toast) {
      window.Main.toast(result.message);
    }
    if (result.success && !result.pending) {
      // Paiement instantanément réussi (mode démo ou IAP)
      refreshState();
    }
  }

  /* =========================================================
     CODE CADEAU
     ========================================================= */
  async function redeemCode() {
    const input = document.getElementById("giftCode");
    if (!input) return;

    const code = input.value.trim();
    if (!code) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Entrez un code cadeau");
      }
      return;
    }

    if (!window.Payments) return;

    const btn = document.querySelector('[data-action="redeem-code"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Vérification…";
    }

    try {
      const result = await window.Payments.redeemCode(code);

      if (result.success) {
        input.value = "";
        if (window.Audio) window.Audio.levelUp();
        if (window.Main && window.Main.toast) {
          window.Main.toast(result.message || "Code activé ✓");
        }
        refreshState();
      } else {
        if (window.Audio) window.Audio.wrong();
        if (window.Main && window.Main.toast) {
          window.Main.toast(result.error || "Code invalide");
        }
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Valider le code";
      }
    }
  }

  /* =========================================================
     RAFRAÎCHIR EN TEMPS RÉEL
     ========================================================= */
  document.addEventListener("premium-activated", function() {
    if (isPremiumVisible()) {
      refreshState();
    }
  });

  function isPremiumVisible() {
    const screen = document.getElementById("screen-premium");
    return screen && screen.classList.contains("active");
  }

  /* -------- API publique -------- */
  return {
    show: show,
    payStripe: payStripe,
    payPayPal: payPayPal,
    payApple: payApple,
    payGoogle: payGoogle,
    redeemCode: redeemCode,
    refreshState: refreshState
  };
})();

window.PremiumScreen = PremiumScreen;
console.log("✓ PremiumScreen chargé");
