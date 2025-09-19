// worksheets/test/TEST/securitate/worksheet.js
// Logica specifică pentru activitatea "Securitatea în mediul digital"

// Funcția principală care inițializează worksheet-ul specific
function initializeSpecificWorksheet(authData) {
  // Verifică statusul worksheet-ului
  if (!checkWorksheetStatus(authData)) {
    return; // Worksheet inactiv sau fără încercări
  }

  // Extrage datele structurii
  worksheetSteps = authData.worksheet.structure.steps || [];

  if (worksheetSteps.length === 0) {
    showMessage('Nu există pași definiți pentru această activitate', 'error');
    return;
  }

  // Actualizează numărul total de pași
  document.getElementById('total-steps').textContent = worksheetSteps.length;

  // Construiește HTML-ul pentru pași
  buildWorksheetSteps();

  // Inițializează progresul elevului
  initializeStudentProgress(authData);

  // Afișează primul pas necompletat
  currentStepIndex = findFirstIncompleteStep();
  showCurrentStep();
  updateNavigation();
}

// Construiește HTML-ul pentru toți pașii
function buildWorksheetSteps() {
  const container = document.getElementById('steps-container');
  container.innerHTML = '';

  worksheetSteps.forEach((stepData, index) => {
    const stepElement = createStepElement(stepData, index);
    container.appendChild(stepElement);
  });
}

// Creează elementul HTML pentru un pas
function createStepElement(stepData, stepIndex) {
  const templateId = stepData.type === 'grila' ? 'grila-step-template' : 'short-step-template';
  const template = document.getElementById(templateId);

  if (!template) {
    console.error(`Template-ul ${templateId} nu a fost găsit`);
    return document.createElement('div');
  }

  const stepElement = template.content.cloneNode(true);

  // Setează atributele pasului
  const stepDiv = stepElement.querySelector('.step');
  stepDiv.dataset.stepIndex = stepIndex;
  stepDiv.classList.add('hidden'); // Inițial ascuns

  // Populează numărul pasului
  stepElement.querySelector('.step-number').textContent = stepIndex + 1;

  // Populează întrebarea
  stepElement.querySelector('.question-text').textContent = stepData.question;

  // Construiește conținutul specific tipului
  if (stepData.type === 'grila') {
    buildGrilaStep(stepElement, stepData, stepIndex);
  } else if (stepData.type === 'short') {
    buildShortStep(stepElement, stepData, stepIndex);
  }

  return stepElement;
}

// Construiește pasul pentru întrebări cu grile
function buildGrilaStep(stepElement, stepData, stepIndex) {
  const optionsContainer = stepElement.querySelector('.options');
  optionsContainer.dataset.step = stepIndex;

  if (!stepData.options || stepData.options.length === 0) {
    console.error(`Opțiunile lipsesc pentru pasul ${stepIndex + 1}`);
    return;
  }

  stepData.options.forEach((option, optionIndex) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `step_${stepIndex}`;
    input.value = optionIndex;
    input.id = `step_${stepIndex}_option_${optionIndex}`;

    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = option;

    optionDiv.appendChild(input);
    optionDiv.appendChild(label);
    optionsContainer.appendChild(optionDiv);

    // Event listener pentru activarea butonului de submit
    input.addEventListener('change', () => {
      enableSubmitButton(stepIndex);
    });
  });
}

// Construiește pasul pentru răspunsuri scurte
function buildShortStep(stepElement, stepData, stepIndex) {
  const textarea = stepElement.querySelector('.short-answer');
  const wordCount = stepElement.querySelector('.word-count');

  textarea.dataset.step = stepIndex;

  // Event listeners pentru validare și contorizare
  textarea.addEventListener('input', () => {
    updateWordCount(textarea, wordCount);
    enableSubmitButton(stepIndex);
  });

  textarea.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      // Ctrl+Enter pentru submit rapid
      const submitBtn = stepElement.querySelector('.submit-step-btn');
      if (!submitBtn.disabled) {
        submitCurrentStep();
      }
    }
  });
}

// Activează/dezactivează butonul de submit pentru un pas
function enableSubmitButton(stepIndex) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  if (!submitBtn) return;

  const isValid = validateStepAnswer(stepIndex);

  submitBtn.disabled = !isValid;
  if (isValid) {
    submitBtn.classList.add('enabled');
  } else {
    submitBtn.classList.remove('enabled');
  }
}

// Validează răspunsul unui pas
function validateStepAnswer(stepIndex) {
  const stepData = worksheetSteps[stepIndex];

  if (stepData.type === 'grila') {
    return isValidGrilaAnswer(stepIndex);
  } else if (stepData.type === 'short') {
    return isValidShortAnswer(stepIndex);
  }

  return false;
}

// Inițializează progresul elevului
function initializeStudentProgress(authData) {
  // Resetează progresul
  studentProgress = {};

  // Inițializează fiecare pas
  worksheetSteps.forEach((_, index) => {
    studentProgress[index] = {
      completed: false,
      answer: null,
      feedback: null,
      score: 0,
    };
  });

  // Încarcă progresul existent dacă există
  if (authData.session.progress && authData.session.progress.length > 0) {
    loadExistingProgress(authData.session.progress);
  }
}

// Încarcă progresul existent din baza de date
function loadExistingProgress(progressData) {
  progressData.forEach((progressItem) => {
    const stepIndex = progressItem.step_number - 1; // Convertire la index 0-based

    if (stepIndex >= 0 && stepIndex < worksheetSteps.length) {
      studentProgress[stepIndex] = {
        completed: true,
        answer: progressItem.answer,
        feedback: progressItem.feedback,
        score: progressItem.score,
      };

      // Populează răspunsul în UI
      populateStepAnswer(stepIndex, progressItem.answer);

      // Afișează feedback-ul
      if (progressItem.feedback) {
        showStepFeedback(stepIndex, progressItem.feedback, progressItem.score);
      }
    }
  });
}

// Populează răspunsul unui pas în interfață
function populateStepAnswer(stepIndex, answer) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const stepData = worksheetSteps[stepIndex];

  if (stepData.type === 'grila' && typeof answer === 'number') {
    const radio = stepElement.querySelector(`input[value="${answer}"]`);
    if (radio) {
      radio.checked = true;
      enableSubmitButton(stepIndex);
    }
  } else if (stepData.type === 'short' && typeof answer === 'string') {
    const textarea = stepElement.querySelector('.short-answer');
    if (textarea) {
      textarea.value = answer;
      const wordCount = stepElement.querySelector('.word-count');
      updateWordCount(textarea, wordCount);
      enableSubmitButton(stepIndex);
    }
  }
}

// Găsește primul pas necompletat
function findFirstIncompleteStep() {
  for (let i = 0; i < worksheetSteps.length; i++) {
    if (!studentProgress[i] || !studentProgress[i].completed) {
      return i;
    }
  }
  return worksheetSteps.length - 1; // Toate completate, rămâne la ultimul
}

// Funcția pentru trimiterea pasului curent
function submitCurrentStepWorksheet() {
  if (!validateStepAnswer(currentStepIndex)) {
    showMessage('Completează răspunsul înainte de a-l trimite', 'warning');
    return;
  }

  const answer = getStepAnswer(currentStepIndex);
  if (answer === null || answer === undefined) {
    showMessage('Răspunsul nu a putut fi extras', 'error');
    return;
  }

  // Apelează funcția din common.js
  submitStepToServer(currentStepIndex, answer);
}

// Funcția pentru finalizarea worksheet-ului
function finalizeWorksheet() {
  // Verifică dacă toate pașii sunt completați
  const allCompleted = Object.values(studentProgress).every((p) => p && p.completed);

  if (!allCompleted) {
    showMessage('Toate pașii trebuie completați înainte de finalizare', 'warning');
    return;
  }

  // Calculează scorul total
  const totalScore = Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0);
  const maxScore = worksheetSteps.reduce((sum, step) => sum + step.points, 0);

  // Afișează secțiunea de completare
  document.getElementById('worksheet-section').classList.add('hidden');
  document.getElementById('completion-section').classList.remove('hidden');

  // Populează rezultatele finale
  document.getElementById('final-score').textContent = `${totalScore}/${maxScore} puncte`;

  // Generează feedback final
  const feedbackText = generateFinalFeedback(totalScore, maxScore);
  document.getElementById('final-feedback').textContent = feedbackText;

  showMessage('Activitatea a fost finalizată cu succes!', 'success');
}

// Generează feedback final pe baza scorului
function generateFinalFeedback(totalScore, maxScore) {
  const percentage = (totalScore / maxScore) * 100;

  if (percentage >= 90) {
    return 'Excelent! Ai demonstrat o înțelegere foarte bună a conceptelor de securitate digitală.';
  } else if (percentage >= 75) {
    return 'Foarte bine! Ai înțeles majoritatea conceptelor importante despre securitate.';
  } else if (percentage >= 60) {
    return 'Bine! Ai o bază solidă, dar mai poți îmbunătăți cunoștințele despre securitate.';
  } else {
    return 'Te încurajez să studiezi mai mult despre securitatea digitală. Este un domeniu foarte important!';
  }
}

// Funcția pentru afișarea review-ului
function displayWorksheetReview() {
  // Ascunde secțiunea de completare
  document.getElementById('completion-section').classList.add('hidden');

  // Afișează secțiunea principală în mod review
  document.getElementById('worksheet-section').classList.remove('hidden');

  // Afișează toți pașii cu feedback-urile lor
  worksheetSteps.forEach((_, index) => {
    const stepElement = document.querySelector(`[data-step-index="${index}"]`);
    if (stepElement) {
      stepElement.classList.remove('hidden');

      // Dezactivează toate input-urile pentru review
      const inputs = stepElement.querySelectorAll('input, textarea, button');
      inputs.forEach((input) => {
        input.disabled = true;
      });
    }
  });

  // Actualizează navigarea pentru review
  document.getElementById('prev-btn').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('finish-btn').style.display = 'none';

  showMessage('Mod recenzie: Vezi toate răspunsurile și feedback-urile primite', 'info');
}
