// worksheets/test/TEST/securitate/worksheet.js
// Logica specifică pentru activitatea "Securitatea în mediul digital"
// Refactorizat cu finalizare AI globală

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

// Funcția pentru finalizarea worksheet-ului cu AI global
async function finalizeWorksheet() {
  // Verifică dacă toate pașii sunt completați
  const allCompleted = Object.values(studentProgress).every((p) => p && p.completed);

  if (!allCompleted) {
    showMessage('Toate pașii trebuie completați înainte de finalizare', 'warning');
    return;
  }

  // Setează UI în stare de loading pentru finalizare
  setFinalizationLoadingState(true);

  try {
    // Generează raportul AI global
    const globalReport = await generateGlobalAIReport();

    if (!globalReport || !globalReport.success) {
      throw new Error(globalReport?.error || 'Eroare la generarea raportului AI');
    }

    // Salvează raportul în baza de date
    await saveGlobalReport(globalReport.feedback);

    // Calculează statistici finale
    const totalScore = Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0);
    const maxScore = worksheetSteps.reduce((sum, step) => sum + step.points, 0);

    // Afișează secțiunea de completare cu raportul AI
    showCompletionSection(totalScore, maxScore, globalReport.feedback);

    showMessage('Activitatea a fost finalizată și evaluată complet de AI!', 'success');
  } catch (error) {
    console.error('Eroare la finalizarea cu AI:', error);

    // Fallback la finalizare fără AI global (doar statistici)
    const totalScore = Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0);
    const maxScore = worksheetSteps.reduce((sum, step) => sum + step.points, 0);

    showCompletionSection(
      totalScore,
      maxScore,
      'Raportul detaliat AI este temporar indisponibil, dar toate răspunsurile tale au fost evaluate individual.'
    );

    showMessage(
      'Activitate finalizată. Raportul AI detaliat nu a putut fi generat momentan.',
      'warning'
    );
  } finally {
    setFinalizationLoadingState(false);
  }
}

// Generează raportul AI global pentru întreaga activitate
async function generateGlobalAIReport() {
  // Pregătește datele pentru AI-ul global
  const reportData = {
    student: {
      name: authenticationData.student.name,
      surname: authenticationData.student.surname,
      grade: authenticationData.student.grade,
    },
    worksheet: {
      title: authenticationData.worksheet.title,
      subject: authenticationData.worksheet.subject,
    },
    performance: {
      totalSteps: worksheetSteps.length,
      completedSteps: Object.values(studentProgress).filter((p) => p && p.completed).length,
      totalScore: Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0),
      maxScore: worksheetSteps.reduce((sum, step) => sum + step.points, 0),
    },
    stepDetails: worksheetSteps.map((step, index) => ({
      stepNumber: index + 1,
      type: step.type,
      question: step.question,
      points: step.points,
      studentAnswer: studentProgress[index]?.answer,
      score: studentProgress[index]?.score || 0,
      feedback: studentProgress[index]?.feedback,
    })),
  };

  console.log('Generez raport AI global pentru:', reportData.student.name);

  try {
    const response = await fetch('/api/generate-global-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reportData,
        requestType: 'global_ai_report',
      }),
    });

    if (!response.ok) {
      throw new Error(`Server response: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Eroare în generarea raportului AI global:', error);
    throw error;
  }
}

// Salvează raportul global în baza de date
async function saveGlobalReport(globalFeedback) {
  try {
    const response = await fetch('/api/save-global-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: authenticationData.student.id,
        worksheetId: authenticationData.worksheet.id,
        attemptNumber: authenticationData.session.current_attempt,
        globalFeedback: globalFeedback,
      }),
    });

    if (!response.ok) {
      console.error('Nu s-a putut salva raportul global în BD');
    }
  } catch (error) {
    console.error('Eroare la salvarea raportului global:', error);
  }
}

// Setează UI în stare de loading pentru finalizare
function setFinalizationLoadingState(isLoading) {
  const finishBtn = document.getElementById('finish-btn');

  if (isLoading) {
    finishBtn.disabled = true;
    finishBtn.textContent = 'Se generează raportul AI...';
    finishBtn.classList.add('loading');

    // Afișează mesaj de progres
    showMessage('AI-ul analizează performanța ta completă. Te rugăm să aștepți...', 'info');
  } else {
    finishBtn.classList.remove('loading');
  }
}

// Afișează secțiunea de completare cu raportul AI
function showCompletionSection(totalScore, maxScore, globalFeedback) {
  // Ascunde secțiunea de lucru
  document.getElementById('worksheet-section').classList.add('hidden');

  // Afișează secțiunea de completare
  document.getElementById('completion-section').classList.remove('hidden');

  // Populează scorul final
  const scoreElement = document.getElementById('final-score');
  const percentage = (totalScore / maxScore) * 100;
  scoreElement.innerHTML = `
    <div class="score-display">
      <span class="score-points">${totalScore}/${maxScore} puncte</span>
      <span class="score-percentage">(${percentage.toFixed(1)}%)</span>
    </div>
  `;

  // Adaugă clasa CSS pentru culoarea scorului
  if (percentage >= 80) {
    scoreElement.classList.add('score-excellent');
  } else if (percentage >= 60) {
    scoreElement.classList.add('score-good');
  } else {
    scoreElement.classList.add('score-needs-improvement');
  }

  // Populează feedback-ul AI global
  const feedbackElement = document.getElementById('final-feedback');
  feedbackElement.innerHTML = `
    <div class="ai-report">
      <h4>Raport AI complet - Securitate Digitală</h4>
      <div class="ai-feedback-text">${globalFeedback}</div>
    </div>
  `;
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

      // Marchează ca review mode
      stepElement.classList.add('review-mode');
    }
  });

  // Ascunde navigarea normală
  document.getElementById('prev-btn').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('finish-btn').style.display = 'none';

  // Adaugă buton pentru revenire
  const navigation = document.querySelector('.navigation');
  const returnBtn = document.createElement('button');
  returnBtn.textContent = 'Înapoi la rezultate';
  returnBtn.className = 'nav-btn primary';
  returnBtn.onclick = () => {
    document.getElementById('worksheet-section').classList.add('hidden');
    document.getElementById('completion-section').classList.remove('hidden');
  };
  navigation.appendChild(returnBtn);

  showMessage('Mod recenzie: Vezi toate răspunsurile și feedback-urile primite', 'info');
}
