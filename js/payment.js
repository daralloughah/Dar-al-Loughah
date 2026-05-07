/* =========================================================
   DAR AL LOUGHAH — PAIEMENTS
   - Stripe (Payment Link recommandé)
   - PayPal (Payment Link)
   - Apple Pay (web ou IAP wrapper)
   - Google Pay
   - Codes cadeau / promo
   - Vérification & activation du Premium
   ========================================================= */

const Payments = (function() {

  const CFG = window.CONFIG || {};

  // Codes promo prédéfinis (tu peux en ajouter sur ton backend)
  const LOCAL_PROMO_CODES = {
    "WELCOME2026":    { months: 1, type: "free_month",  label: "1 mois offert" },
    "RAMADAN":        { months: 1, type: "free_month",  label: "1 mois Ramadan" },
    "MOUALLIM":       { months: 3, type: "free_month",  label: "3 mois offerts" },
    "DAR-LIFETIME":   { months: 999, type: "lifetime",  label: "Premium à vie" }
  };

  /* =========================================================
     DÉTECTION DE L'ENVIRONNEMENT
     ========================================================= */
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function isApplePayAvailable() {
    return isIOS() && window.ApplePaySession && window.ApplePaySession.canMakePayments;
  }

  function isInWebView() {
    // Détecte si on est dans une app native wrappée (Capacitor / Cordova)
    return !!(window.Capacitor || window.cordova);
  }

  /* =========================================================
     AFFICHER LES BOUTONS DE PAIEMENT SELON L'APPAREIL
     ========================================================= */
  function setupPaymentButtons() {
    const appleBtn = document.getElementById("payAppleBtn");
    const googleBtn = document.getElementById("payGoogleBtn");

    if (appleBtn && isIOS()) {
      appleBtn.hidden = false;
    }
    if (googleBtn && isAndroid()) {
      googleBtn.hidden = false;
    }
  }

  /* =========================================================
     STRIPE
     ========================================================= */
  function payWithStripe() {
    const link = CFG.STRIPE_PAYMENT_LINK;

    if (!link) {
      // Mode démo : simuler un paiement réussi
      return demoPayment("stripe");
    }

    // Construire l'URL avec metadata pour identifier l'utilisateur
    let url = link;
    const email = (window.State && window.State.get("email")) || "";
    if (email) {
      const sep = url.includes("?") ? "&" : "?";
      url += sep + "prefilled_email=" + encodeURIComponent(email);
    }
    // Ouvrir Stripe Checkout dans un nouvel onglet
    window.open(url, "_blank");

    // Afficher un message à l'utilisateur
    return {
      success: true,
      pending: true,
      message: "Finalisez votre paiement dans la page Stripe ouverte. Le Premium sera activé après confirmation."
    };
  }

  /* =========================================================
     PAYPAL
     ========================================================= */
  function payWithPayPal() {
    const link = CFG.PAYPAL_PAYMENT_LINK;

    if (!link) {
      return demoPayment("paypal");
    }

    let url = link;
    const email = (window.State && window.State.get("email")) || "";
    if (email) {
      const sep = url.includes("?") ? "&" : "?";
      url += sep + "email=" + encodeURIComponent(email);
    }
    window.open(url, "_blank");

    return {
      success: true,
      pending: true,
      message: "Finalisez votre paiement dans la page PayPal ouverte."
    };
  }

  /* =========================================================
     APPLE PAY (web ou IAP si app native)
     ========================================================= */
  function payWithApple() {
    if (isInWebView() && window.cordova && window.cordova.plugins && window.cordova.plugins.purchase) {
      // Wrapper natif iOS : utiliser IAP
      return triggerNativeIAP("apple");
    }

    if (!isApplePayAvailable()) {
      return demoPayment("apple");
    }

    if (CFG.STRIPE_PAYMENT_LINK) {
      // Stripe gère Apple Pay nativement
      return payWithStripe();
    }

    return demoPayment("apple");
  }

  /* =========================================================
     GOOGLE PAY (web ou Play Billing si app native)
     ========================================================= */
  function payWithGoogle() {
    if (isInWebView() && window.cordova && window.cordova.plugins && window.cordova.plugins.purchase) {
      // Wrapper natif Android : utiliser Play Billing
      return triggerNativeIAP("google");
    }

    if (CFG.STRIPE_PAYMENT_LINK) {
      // Stripe gère Google Pay nativement
      return payWithStripe();
    }

    return demoPayment("google");
  }

  /* =========================================================
     CODES CADEAU / PROMO
     ========================================================= */
  async function redeemCode(code) {
    if (!code || code.trim().length === 0) {
      return { success: false, error: "Veuillez entrer un code" };
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Backend
    if (CFG.BACKEND_URL && navigator.onLine !== false) {
      try {
        const res = await fetch(CFG.BACKEND_URL + "/payments/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: cleanCode,
            email: window.State && window.State.get("email") || ""
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            activatePremium("code:" + cleanCode, data);
            return { success: true, message: data.label || "Code activé !" };
          }
          return { success: false, error: data.message || "Code invalide" };
        }
      } catch (e) {
        // fallback local
      }
    }

    // 2. Codes locaux
    const local = LOCAL_PROMO_CODES[cleanCode];
    if (!local) {
      return { success: false, error: "Code invalide ou expiré" };
    }

    // Vérifier que le code n'a pas déjà été utilisé
    const usedCodes = getUsedCodes();
    if (usedCodes.includes(cleanCode)) {
      return { success: false, error: "Ce code a déjà été utilisé sur ce compte" };
    }

    // Marquer le code comme utilisé
    markCodeAsUsed(cleanCode);

    // Activer le premium
    activatePremium("code:" + cleanCode, local);

    return { success: true, message: local.label + " activé !" };
  }

  function getUsedCodes() {
    try {
      const raw = localStorage.getItem("dar_used_codes");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function markCodeAsUsed(code) {
    const used = getUsedCodes();
    if (!used.includes(code)) {
      used.push(code);
      try {
        localStorage.setItem("dar_used_codes", JSON.stringify(used));
      } catch (e) {}
    }
  }

  /* =========================================================
     ACTIVATION DU PREMIUM
     ========================================================= */
  function activatePremium(reference, details) {
    if (!window.State) return;

    window.State.update({
      isPremium: true,
      premiumSince: Date.now(),
      premiumPaymentRef: reference || ""
    });

    // Vérifier le badge Premium
    if (window.XP) {
      window.XP.checkBadges();
    }

    // Émettre événement (pour main.js qui affichera une modale)
    document.dispatchEvent(new CustomEvent("premium-activated", { detail: details || {} }));

    // Son de réussite
    if (window.Audio) {
      window.Audio.levelUp();
    }
  }

  function deactivatePremium() {
    if (!window.State) return;
    window.State.update({
      isPremium: false,
      premiumSince: null,
      premiumPaymentRef: ""
    });
    document.dispatchEvent(new CustomEvent("premium-deactivated"));
  }

  function isPremium() {
    return window.State && window.State.get("isPremium") === true;
  }

  /* =========================================================
     IAP NATIF (Capacitor / Cordova wrapper)
     Pour quand tu emballeras l'app pour App Store / Play Store
     ========================================================= */
  function triggerNativeIAP(platform) {
    try {
      const productId = platform === "apple"
        ? "com.daralloughah.premium.monthly"
        : "premium_monthly";

      if (window.cordova && window.cordova.plugins && window.cordova.plugins.purchase) {
        const store = window.cordova.plugins.purchase;
        store.order(productId).then(function() {
          activatePremium("iap:" + platform);
        }).catch(function(e) {
          console.warn("IAP error:", e);
        });
        return { success: true, pending: true };
      }
    } catch (e) {
      console.warn("Native IAP non disponible:", e);
    }
    return demoPayment(platform);
  }

  /* =========================================================
     MODE DÉMO (pour tester l'app sans payer)
     ========================================================= */
  function demoPayment(method) {
    const ok = confirm(
      "💎 Mode démo (" + method + ")\n\n" +
      "Aucun lien de paiement n'est configuré.\n" +
      "Voulez-vous activer le Premium en mode démo ?\n\n" +
      "(Tu pourras configurer Stripe/PayPal plus tard dans config.js)"
    );

    if (ok) {
      activatePremium("demo:" + method);
      return {
        success: true,
        message: "Premium activé en mode démo !"
      };
    }
    return { success: false, error: "Annulé" };
  }

  /* =========================================================
     VÉRIFICATION D'UN PAIEMENT (post-redirect)
     ========================================================= */
  async function verifyPaymentReturn() {
    // Détecter si on revient d'une page Stripe / PayPal réussie
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id") || params.get("payment_id");
    const success = params.get("success") || params.get("status");

    if (sessionId && (success === "true" || success === "completed" || success === "approved")) {
      if (window.Api) {
        const result = await window.Api.verifyPayment(sessionId);
        if (result && result.verified) {
          activatePremium("verified:" + sessionId);
          // Nettoyer l'URL
          window.history.replaceState({}, "", window.location.pathname);
          return { success: true };
        }
      }
      // Fallback : faire confiance au retour
      activatePremium("trusted:" + sessionId);
      window.history.replaceState({}, "", window.location.pathname);
      return { success: true };
    }
    return { success: false };
  }

  /* =========================================================
     RESTAURATION D'ACHATS (App Store / Play Store)
     ========================================================= */
  function restorePurchases() {
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.purchase) {
      try {
        window.cordova.plugins.purchase.restore();
        return { success: true, message: "Restauration en cours..." };
      } catch (e) {
        return { success: false, error: "Erreur de restauration" };
      }
    }
    return { success: false, error: "Restauration non disponible" };
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    setupPaymentButtons();
    // Vérifier si on revient d'une page de paiement
    verifyPaymentReturn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* -------- API publique -------- */
  return {
    payWithStripe: payWithStripe,
    payWithPayPal: payWithPayPal,
    payWithApple: payWithApple,
    payWithGoogle: payWithGoogle,
    redeemCode: redeemCode,
    activatePremium: activatePremium,
    deactivatePremium: deactivatePremium,
    isPremium: isPremium,
    restorePurchases: restorePurchases,
    setupPaymentButtons: setupPaymentButtons,
    isIOS: isIOS,
    isAndroid: isAndroid
  };
})();

window.Payments = Payments;
console.log("✓ Payments chargé");
