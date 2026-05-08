/* =========================================================
   DAR AL LOUGHAH — SCREEN: CONTACT
   - Formulaire de contact
   - Envoi via Formsubmit (sans backend)
   - Validation des champs
   ========================================================= */

const ContactScreen = (function() {

  /* =========================================================
     SHOW : pré-remplir si possible
     ========================================================= */
  function show() {
    if (!window.State) return;

    // Pré-remplir avec les infos du compte
    const nameInput = document.getElementById("ctName");
    const emailInput = document.getElementById("ctEmail");

    const pseudo = window.State.get("pseudo");
    const email = window.State.get("email");

    if (nameInput && pseudo && pseudo !== "Apprenti" && pseudo !== "Invité" && !nameInput.value) {
      nameInput.value = pseudo;
    }
    if (emailInput && email && !emailInput.value) {
      emailInput.value = email;
    }
  }

  /* =========================================================
     ENVOI DU FORMULAIRE
     ========================================================= */
  async function send() {
    const nameInput = document.getElementById("ctName");
    const emailInput = document.getElementById("ctEmail");
    const subjectSelect = document.getElementById("ctSubject");
    const msgInput = document.getElementById("ctMsg");

    if (!nameInput || !emailInput || !subjectSelect || !msgInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const subject = subjectSelect.value;
    const message = msgInput.value.trim();

    // Validation
    if (!name || name.length < 2) {
      toast("Veuillez entrer votre nom");
      return;
    }
    if (!email || !validateEmail(email)) {
      toast("Email invalide");
      return;
    }
    if (!subject) {
      toast("Choisissez un sujet");
      return;
    }
    if (!message || message.length < 5) {
      toast("Message trop court");
      return;
    }

    // Désactiver le bouton pendant l'envoi
    const submitBtn = document.querySelector('[data-action="send-contact"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Envoi en cours…";
    }

    try {
      const result = await window.Api.sendContact({
        name: name,
        email: email,
        subject: subject,
        message: message
      });

      if (result && result.success) {
        // Réinitialiser le formulaire
        nameInput.value = "";
        emailInput.value = "";
        subjectSelect.value = "";
        msgInput.value = "";

        if (window.Audio) window.Audio.correct();
        toast("Message envoyé ✓ Merci !");

        // Pré-remplir à nouveau avec les infos du compte
        setTimeout(show, 100);
      } else {
        toast("Échec de l'envoi. Réessayez plus tard.");
      }
    } catch (e) {
      toast("Erreur d'envoi. Vérifiez votre connexion.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Envoyer";
      }
    }
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function toast(msg) {
    if (window.Main && window.Main.toast) {
      window.Main.toast(msg);
    } else {
      console.log("[Contact]", msg);
    }
  }

  /* -------- API publique -------- */
  return {
    show: show,
    send: send
  };
})();

window.ContactScreen = ContactScreen;
console.log("✓ ContactScreen chargé");
