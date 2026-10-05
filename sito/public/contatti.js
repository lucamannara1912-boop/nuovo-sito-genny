/* ===================================================================
   CONTATTI.JS — GESTIONE INTERATTIVITÀ (COPIA TELEFONO)
   =================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const cardTelefono = document.getElementById("cardTelefono");

  if (cardTelefono) {
    cardTelefono.addEventListener("click", () => {
      const numero = "+393501767452";
      navigator.clipboard.writeText(numero).then(() => {
        const etichetta = document.getElementById("testoEtichettaTel");
        const testoOriginale = etichetta.innerText;
        
        etichetta.innerText = "✓ NUMERO COPIATO!";
        etichetta.style.color = "#198754";
        
        setTimeout(() => {
          etichetta.innerText = testoOriginale;
          etichetta.style.color = "";
        }, 2500);
      }).catch(err => {
        console.error("Errore durante la copia del numero: ", err);
      });
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".card-item");

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Coordinate per la luce radiale
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);

      // Calcolo inclinazione 3D (Tilt)
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -10; // Inclinazione asse X
      const rotateY = ((x - centerX) / centerX) * 10;  // Inclinazione asse Y

      // Applica la rotazione tridimensionale alla card principale
      card.style.transform = `translateY(-8px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    // Ritorno alla posizione iniziale quando il mouse esce
    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0px) perspective(1000px) rotateX(0deg) rotateY(0deg)";
    });
  });
});