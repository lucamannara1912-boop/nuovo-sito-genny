'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Gestione apertura/chiusura FAQ a fisarmonica
  document.querySelectorAll('.faq-domanda').forEach(bottone => {
    bottone.addEventListener('click', () => {
      const cardFaq = bottone.parentElement;
      cardFaq.classList.toggle('aperta');
    });
  });

  // 2. Effetto Tilt 3D al movimento del mouse sulla foto della laurea
  const card3D = document.getElementById('cardFoto3D');
  if (card3D) {
    const innerCard = card3D.querySelector('.card-foto-laurea');

    card3D.addEventListener('mousemove', (e) => {
      const rect = card3D.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const rotX = (-y / 10);
      const rotY = (x / 10);

      innerCard.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
    });

    card3D.addEventListener('mouseleave', () => {
      innerCard.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
    });
  }

  // 3. Scroll Reveal
  const observerOptions = { threshold: 0.15 };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visibile');
      }
    });
  }, observerOptions);

  document.querySelectorAll('.sezione-presentazione-bio, .sezione-timeline, .intestazione-sezione-centrale, .sezione-due-colonne, .sezione-faq').forEach(sezione => {
    observer.observe(sezione);
  });

  /* ---------- FOGLIE BOTANICHE SFONDO ---------- */
  const numFoglie = 7;
  const iconeBotaniche = ['🌿', '🍃', '🌱', '🍂', '🍀'];

  for (let i = 0; i < numFoglie; i++) {
    const foglia = document.createElement('div');
    foglia.classList.add('particella-botanica');
    foglia.innerHTML = iconeBotaniche[Math.floor(Math.random() * iconeBotaniche.length)];
    foglia.style.left = `${Math.random() * 100}vw`;
    foglia.style.top = `${Math.random() * 100}vh`;
    foglia.style.fontSize = `${Math.random() * 10 + 14}px`;
    foglia.style.opacity = Math.random() * 0.3 + 0.25; 
    
    const durata = Math.random() * 6 + 5; 
    foglia.style.animation = `fluttuaParticellaDinamica ${durata}s ease-in-out infinite alternate`;
    foglia.style.animationDelay = `${Math.random() * 5}s`;
    
    document.body.appendChild(foglia);
  }
});