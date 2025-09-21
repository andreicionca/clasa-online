// js/index.js - Funcționalități pentru pagina principală

document.addEventListener('DOMContentLoaded', function () {
  initializeIndexPage();
});

function initializeIndexPage() {
  console.log('Pagina principală încărcată');

  // Funcționalități viitoare pentru:
  // - Filtrarea fișelor de lucru
  // - Căutarea
  // - Sortarea după materie/clasă
  // - Progresul elevului

  setupFutureFeatures();
}

function setupFutureFeatures() {
  // Placeholder pentru funcționalități viitoare

  // Exemplu: detectarea click-urilor pe card-urile coming-soon
  const comingSoonCards = document.querySelectorAll('.worksheet-card.coming-soon');

  comingSoonCards.forEach((card) => {
    card.addEventListener('click', () => {
      showComingSoonMessage();
    });
  });
}

function showComingSoonMessage() {
  // Mesaj simplu pentru fișele în construcție
  alert('Această fișă de lucru va fi disponibilă în curând!');
}

// Funcții helper pentru dezvoltare viitoare
function addWorksheet(worksheetData) {
  // Pentru adăugarea dinamică de fișe noi
  console.log('Funcție pentru adăugarea de fișe:', worksheetData);
}

function filterWorksheets(criteria) {
  // Pentru filtrarea fișelor după criterii
  console.log('Funcție pentru filtrare:', criteria);
}
