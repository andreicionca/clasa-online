// worksheets/test/TEST/securitate/worksheet.js
// Logica specifică pentru activitatea "Securitatea în mediul digital"
// Reconstruit de la zero - focusat pe construirea UI și orchestrare

// Funcția principală - inițializează worksheet-ul după autentificare
function initializeSpecificWorksheet(authData) {
  // Verifică statusul worksheet-ului prin funcția din common.js
  if (!checkWorksheetStatus(authData)) {
    return; // Worksheet inactiv sau fără încercări disponibile
  }

  // Extrage și validează structura
  worksheetSteps = authData.worksheet.structure.steps || [];
  if (worksheetSteps.length === 0) {
    showMessage('Nu există pași definiți pentru această activitate', 'error');
    return;
  }

  // Actualizează UI-ul cu numărul total de pași
  document.getElementById('total-steps').textContent = worksheetSteps.length;

  // Construiește interfața dinamică
  buildWorksheetInterface();

  // Inițializează și încarcă progresul
  initializeProgressTracking(authData);

  // Afișează primul pas disponibil
  navigateToFirstAvailableStep();
}

// Construiește întreaga interfață din structura JSON
function buildWorksheetInterface() {
  const container = document.getElementById('steps-container');
  container.innerHTML = '';

  worksheetSteps.forEach((stepData, index) => {
    const stepElement = createStepFromTemplate(stepData, index);
    container.appendChild(stepElement);
  });
}

// Creează un pas folosind template-urile HTML
function createStepFromTemplate(stepData, stepIndex) {
  const templateId = stepData.type === 'grila' ? 'grila-step-template' : 'short-step-template';
  const template = document.getElementById(templateId);

  if (!template) {
    console.error(`Template-ul ${templateId} nu a fost găsit`);
    return document.createElement('div'); // Return element gol
  }

  const stepElement = template.content.cloneNode(true);
  const stepDiv = stepElement.querySelector('.step');

  // Configurează atributele de bază
  stepDiv.dataset.stepIndex = stepIndex;
  stepDiv.classList.add('hidden'); // Inițial toate ascunse

  // Populează numărul și întrebarea
  stepElement.querySelector('.step-number').textContent = stepIndex + 1;
  stepElement.querySelector('.question-text').textContent = stepData.question;

  // Construiește conținutul specific tipului
  if (stepData.type === 'grila') {
    setupGrilaStep(stepElement, stepData, stepIndex);
  } else if (stepData.type === 'short') {
    setupShortStep(stepElement, stepData, stepIndex);
  }

  return stepElement;
}

// Configurează un pas cu grile
function setupGrilaStep(stepElement, stepData, stepIndex) {
  const optionsContainer = stepElement.querySelector('.options');

  if (!stepData.options || stepData.options.length === 0) {
    console.error(`Opțiunile lipsesc pentru pasul ${stepIndex + 1}`);
    return;
  }

  // Creează opțiunile radio
  stepData.options.forEach((option, optionIndex) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option';

    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.name = `step_${stepIndex}`;
    radioInput.value = optionIndex;
    radioInput.id = `step_${stepIndex}_option_${optionIndex}`;

    const labelElement = document.createElement('label');
    labelElement.htmlFor = radioInput.id;
    labelElement.textContent = option;

    optionDiv.appendChild(radioInput);
    optionDiv.appendChild(labelElement);
    optionsContainer.appendChild(optionDiv);

    // Event listener pentru activarea submit-ului
    radioInput.addEventListener('change', () => {
      updateSubmitButtonState(stepIndex);
    });
  });
}

// Configurează un pas cu răspuns scurt
function setupShortStep(stepElement, stepData, stepIndex) {
  const textarea = stepElement.querySelector('.short-answer');
  const wordCountDiv = stepElement.querySelector('.word-count');

  // Event listeners pentru input și validare
  textarea.addEventListener('input', () => {
    updateWordCount(textarea, wordCountDiv);
    updateSubmitButtonState(stepIndex);
  });

  // Ctrl+Enter pentru submit rapid
  textarea.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      const submitBtn = stepElement.querySelector('.submit-step-btn');
      if (!submitBtn.disabled) {
        submitCurrentStepWorksheet();
      }
    }
  });
}

// Actualizează starea butonului de submit
function updateSubmitButtonState(stepIndex) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  if (!submitBtn) return;

  const hasValidAnswer = checkStepHasValidAnswer(stepIndex);
  const isCompleted = studentProgress[stepIndex] && studentProgress[stepIndex].completed;

  // Nu permite submit dacă e deja completat
  if (isCompleted) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Completat';
    submitBtn.classList.add('completed');
    return;
  }

  // Activează/dezactivează pe baza validității răspunsului
  submitBtn.disabled = !hasValidAnswer;
  submitBtn.classList.toggle('enabled', hasValidAnswer);
}

// Verifică dacă pasul are răspuns valid
function checkStepHasValidAnswer(stepIndex) {
  const stepData = worksheetSteps[stepIndex];

  if (stepData.type === 'grila') {
    return isValidGrilaAnswer(stepIndex);
  } else if (stepData.type === 'short') {
    return isValidShortAnswer(stepIndex);
  }

  return false;
}

// Inițializează tracking-ul progresului
function initializeProgressTracking(authData) {
  // Resetează progresul local
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

  // Încarcă progresul existent din sesiune
  if (authData.session.progress && authData.session.progress.length > 0) {
    restoreExistingProgress(authData.session.progress);
  }
}

// Restaurează progresul din baza de date
function restoreExistingProgress(progressData) {
  progressData.forEach((progressItem) => {
    const stepIndex = progressItem.step_number - 1; // Convertire 0-based

    if (stepIndex >= 0 && stepIndex < worksheetSteps.length) {
      studentProgress[stepIndex] = {
        completed: true,
        answer: progressItem.answer,
        feedback: progressItem.feedback,
        score: progressItem.score,
      };

      // Restaurează răspunsul în interfață
      restoreStepAnswer(stepIndex, progressItem.answer);

      // Afișează feedback-ul salvat
      if (progressItem.feedback) {
        showStepFeedback(stepIndex, progressItem.feedback, progressItem.score);
      }
    }
  });
}

// Restaurează răspunsul unui pas în interfață
function restoreStepAnswer(stepIndex, answer) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const stepData = worksheetSteps[stepIndex];

  if (stepData.type === 'grila' && typeof answer === 'number') {
    const radio = stepElement.querySelector(`input[value="${answer}"]`);
    if (radio) {
      radio.checked = true;
    }
  } else if (stepData.type === 'short' && typeof answer === 'string') {
    const textarea = stepElement.querySelector('.short-answer');
    if (textarea) {
      textarea.value = answer;
      const wordCountDiv = stepElement.querySelector('.word-count');
      updateWordCount(textarea, wordCountDiv);
    }
  }

  // Actualizează starea butonului
  updateSubmitButtonState(stepIndex);
}

// Navighează la primul pas disponibil
function navigateToFirstAvailableStep() {
  // Găsește primul pas necompletat
  currentStepIndex = 0;
  for (let i = 0; i < worksheetSteps.length; i++) {
    if (!studentProgress[i] || !studentProgress[i].completed) {
      currentStepIndex = i;
      break;
    }
  }

  // Dacă toate sunt completate, rămâne la ultimul
  if (currentStepIndex >= worksheetSteps.length) {
    currentStepIndex = worksheetSteps.length - 1;
  }

  // Afișează pasul curent
  showCurrentStep();
  updateNavigation();
}

// Funcția pentru trimiterea pasului curent - apelată din HTML
function submitCurrentStepWorksheet() {
  if (!checkStepHasValidAnswer(currentStepIndex)) {
    showMessage('Completează răspunsul înainte de a-l trimite', 'warning');
    return;
  }

  const answer = extractStepAnswer(currentStepIndex);
  if (answer === null || answer === undefined) {
    showMessage('Răspunsul nu a putut fi extras din interfață', 'error');
    return;
  }

  // Apelează funcția din common.js pentru submit
  submitStepToServer(currentStepIndex, answer);
}

// Extrage răspunsul din interfață
function extractStepAnswer(stepIndex) {
  const stepData = worksheetSteps[stepIndex];
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);

  if (stepData.type === 'grila') {
    const selectedRadio = stepElement.querySelector('input[type="radio"]:checked');
    return selectedRadio ? parseInt(selectedRadio.value) : null;
  } else if (stepData.type === 'short') {
    const textarea = stepElement.querySelector('.short-answer');
    return textarea ? textarea.value.trim() : null;
  }

  return null;
}

// Finalizează worksheet-ul cu raport AI
async function finalizeWorksheet() {
  // Verifică că toate pașii sunt completați
  const allCompleted = Object.values(studentProgress).every((p) => p && p.completed);
  if (!allCompleted) {
    showMessage('Toate pașii trebuie completați înainte de finalizare', 'warning');
    return;
  }

  // UI loading state
  setFinalizationUIState(true);

  try {
    // Calculează statistici
    const totalScore = Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0);
    const maxScore = worksheetSteps.reduce((sum, step) => sum + step.points, 0);

    // Generează raportul AI final
    const finalReport = await requestFinalAIReport(totalScore, maxScore);

    if (!finalReport || !finalReport.success) {
      throw new Error(finalReport?.error || 'Raportul AI nu a putut fi generat');
    }

    // Afișează completarea cu raportul AI
    displayCompletionWithAIReport(totalScore, maxScore, finalReport.finalReport);
    showMessage('Activitatea finalizată cu raport AI complet!', 'success');
  } catch (error) {
    console.error('Eroare finalizare AI:', error);

    // Fallback fără AI
    const totalScore = Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0);
    const maxScore = worksheetSteps.reduce((sum, step) => sum + step.points, 0);

    displayCompletionWithAIReport(
      totalScore,
      maxScore,
      'Activitatea a fost finalizată cu succes. Raportul AI detaliat nu este disponibil momentan, dar toate răspunsurile au fost evaluate individual.'
    );
    showMessage('Activitate finalizată fără raport AI detaliat', 'warning');
  } finally {
    setFinalizationUIState(false);
  }
}

// Cere raportul AI final prin funcția centralizată
async function requestFinalAIReport(totalScore, maxScore) {
  const performanceData = {
    totalScore: totalScore,
    maxScore: maxScore,
    stepResults: Object.values(studentProgress).map((p) => ({
      score: p.score || 0,
      feedback: p.feedback || '',
    })),
  };

  const studentData = {
    name: authenticationData.student.name,
    surname: authenticationData.student.surname,
    grade: authenticationData.student.grade,
  };

  try {
    const response = await fetch('/.netlify/functions/submit-test-TEST-securitate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'final_report',
        student: studentData,
        performanceData: performanceData,
        allStepsData: worksheetSteps,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Eroare request AI final:', error);
    throw error;
  }
}

// Setează UI-ul pentru finalizare
function setFinalizationUIState(isLoading) {
  const finishBtn = document.getElementById('finish-btn');

  if (isLoading) {
    finishBtn.disabled = true;
    finishBtn.textContent = 'Se generează raportul AI...';
    finishBtn.classList.add('loading');
    showMessage('AI analizează performanța completă...', 'info');
  } else {
    finishBtn.classList.remove('loading');
  }
}

// Afișează completarea cu raportul AI
function displayCompletionWithAIReport(totalScore, maxScore, aiReport) {
  // Tranzitia UI
  document.getElementById('worksheet-section').classList.add('hidden');
  document.getElementById('completion-section').classList.remove('hidden');

  // Afișează scorul cu styling
  const scoreElement = document.getElementById('final-score');
  const percentage = (totalScore / maxScore) * 100;

  scoreElement.innerHTML = `
    <div class="score-display">
      <span class="score-value">${totalScore}/${maxScore} puncte</span>
      <span class="score-percent">(${percentage.toFixed(1)}%)</span>
    </div>
  `;

  // Styling pe baza performanței
  scoreElement.className = 'final-score';
  if (percentage >= 80) scoreElement.classList.add('excellent');
  else if (percentage >= 60) scoreElement.classList.add('good');
  else scoreElement.classList.add('needs-improvement');

  // Afișează raportul AI
  const feedbackElement = document.getElementById('final-feedback');
  feedbackElement.innerHTML = `
    <div class="ai-final-report">
      <h4>Raport final - Securitate Digitală</h4>
      <div class="ai-report-content">${aiReport}</div>
    </div>
  `;
}

// Review mode - afișează toate pașii simultan
function displayWorksheetReview() {
  // Tranzitia UI
  document.getElementById('completion-section').classList.add('hidden');
  document.getElementById('worksheet-section').classList.remove('hidden');

  // Afișează toți pașii în review mode
  worksheetSteps.forEach((_, index) => {
    const stepElement = document.querySelector(`[data-step-index="${index}"]`);
    if (stepElement) {
      stepElement.classList.remove('hidden');
      stepElement.classList.add('review-mode');

      // Dezactivează toate controalele
      const controls = stepElement.querySelectorAll('input, textarea, button');
      controls.forEach((control) => (control.disabled = true));
    }
  });

  // Modifică navigarea pentru review
  const navigation = document.querySelector('.navigation');
  navigation.innerHTML = `
    <button onclick="returnToResults()" class="nav-btn primary">
      Înapoi la rezultate
    </button>
  `;

  showMessage('Mod review: toate răspunsurile și feedback-urile', 'info');
}

// Întoarcere la rezultate din review
function returnToResults() {
  document.getElementById('worksheet-section').classList.add('hidden');
  document.getElementById('completion-section').classList.remove('hidden');
}
