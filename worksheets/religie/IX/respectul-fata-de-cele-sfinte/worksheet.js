// worksheets/religie/IX/respectul-fata-de-cele-sfinte/worksheet.js
// Logica specifică pentru activitatea "Respectul față de cele sfinte"

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

  // Populează punctajele pentru fiecare sarcină
  populateStepPoints();

  // Folosește funcția din common.js cu logica condițională
  initializeProgressTracking(authData);

  // Afișează prima sarcină disponibilă
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

// Populează punctajele pentru fiecare sarcină
function populateStepPoints() {
  const exerciseConfig = authenticationData.worksheet.structure.exercise_config || {
    has_scoring: true,
  };

  if (!exerciseConfig.has_scoring) {
    return;
  }

  worksheetSteps.forEach((stepData, index) => {
    const stepElement = document.querySelector(`[data-step-index="${index}"]`);
    const pointsElement = stepElement.querySelector('.step-points');

    if (pointsElement && stepData.points) {
      pointsElement.textContent = `${stepData.points} punct${stepData.points > 1 ? 'e' : ''}`;
      pointsElement.classList.remove('hidden');
    }
  });
}

// Creează o sarcină folosind template-urile HTML
function createStepFromTemplate(stepData, stepIndex) {
  const templateId = stepData.type === 'grila' ? 'grila-step-template' : 'short-step-template';
  const template = document.getElementById(templateId);

  if (!template) {
    console.error(`Template-ul ${templateId} nu a fost găsit`);
    return document.createElement('div');
  }

  const stepElement = template.content.cloneNode(true);
  const stepDiv = stepElement.querySelector('.step');

  // Configurează atributele de bază
  stepDiv.dataset.stepIndex = stepIndex;
  stepDiv.classList.add('hidden');

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

// Configurează o sarcină cu grile
function setupGrilaStep(stepElement, stepData, stepIndex) {
  const optionsContainer = stepElement.querySelector('.options');

  if (!stepData.options || stepData.options.length === 0) {
    console.error(`Opțiunile lipsesc pentru sarcina ${stepIndex + 1}`);
    return;
  }

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

    radioInput.addEventListener('change', () => {
      updateSubmitButtonState(stepIndex);
    });
  });
}

// Configurează o sarcină cu răspuns scurt
function setupShortStep(stepElement, stepData, stepIndex) {
  const textarea = stepElement.querySelector('.short-answer');
  const wordCountDiv = stepElement.querySelector('.word-count');
  let lastLength = 0;

  function showPasteAlarm(e, revertValue = null) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    const originalValue = revertValue !== null ? revertValue : textarea.value;
    const originalStyle = textarea.style.cssText;

    textarea.value =
      '🧠 ChatGPT speaking: Te-am prins! Nu copia răspunsurile. Dumnezeu vede toate și vrea să-ți cunoască gândurile sincere! 🙏';
    textarea.style.backgroundColor = '#fff3cd';
    textarea.style.color = '#856404';
    textarea.style.fontWeight = 'bold';
    textarea.readOnly = true;

    setTimeout(() => {
      textarea.value = originalValue;
      textarea.style.cssText = originalStyle;
      textarea.readOnly = false;
      textarea.focus();
      lastLength = originalValue.length;
    }, 6000);
  }

  textarea.addEventListener('input', (e) => {
    const currentLength = textarea.value.length;
    const difference = currentLength - lastLength;

    if (difference > 15) {
      const revertValue = textarea.value.substring(0, lastLength);
      showPasteAlarm(e, revertValue);
      return;
    }

    lastLength = currentLength;
    updateWordCount(textarea, wordCountDiv);
    updateSubmitButtonState(stepIndex);
  });

  textarea.addEventListener('paste', showPasteAlarm);
  textarea.addEventListener('drop', showPasteAlarm);
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      showPasteAlarm(e);
    }
  });

  textarea.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      const submitBtn = stepElement.querySelector('.submit-step-btn');
      if (!submitBtn.disabled) {
        submitCurrentStepWorksheet();
      }
    }
  });
}

// Funcția pentru trimiterea sarcinii curente
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
  const allCompleted = Object.values(studentProgress).every((p) => p && p.completed);
  if (!allCompleted) {
    showMessage('Toate pașii trebuie completați înainte de finalizare', 'warning');
    return;
  }

  setFinalizationUIState(true);

  try {
    const exerciseConfig = authenticationData.worksheet.structure.exercise_config || {
      has_scoring: true,
    };

    let totalScore = 0;
    let maxScore = 0;

    if (exerciseConfig.has_scoring) {
      totalScore = Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0);
      maxScore =
        exerciseConfig.total_points ||
        worksheetSteps.reduce((sum, step) => sum + (step.points || 0), 0);
    }

    const finalReport = await requestFinalAIReport(totalScore, maxScore, exerciseConfig);

    if (!finalReport || !finalReport.success) {
      throw new Error(finalReport?.error || 'Raportul AI nu a putut fi generat');
    }

    await markAttemptAsCompleted(finalReport.finalReport);

    displayCompletionWithAIReport(totalScore, maxScore, finalReport.finalReport, exerciseConfig);

    showMessage('Activitatea finalizată cu raport AI complet!', 'success');
  } catch (error) {
    console.error('Eroare finalizare AI:', error);

    try {
      await markAttemptAsCompleted();
    } catch (markError) {
      console.error('Eroare marcare finalizare:', markError);
    }

    const exerciseConfig = authenticationData.worksheet.structure.exercise_config || {
      has_scoring: true,
    };
    const totalScore = exerciseConfig.has_scoring
      ? Object.values(studentProgress).reduce((sum, p) => sum + (p.score || 0), 0)
      : 0;
    const maxScore = exerciseConfig.has_scoring
      ? exerciseConfig.total_points ||
        worksheetSteps.reduce((sum, step) => sum + (step.points || 0), 0)
      : 0;

    displayCompletionWithAIReport(
      totalScore,
      maxScore,
      'Activitatea a fost finalizată cu succes. Raportul AI detaliat nu este disponibil momentan, dar toate răspunsurile au fost evaluate individual.',
      exerciseConfig
    );
    showMessage('Activitate finalizată fără raport AI detaliat', 'warning');
  } finally {
    setFinalizationUIState(false);
  }
}

// Marchează încercarea curentă ca fiind completă
async function markAttemptAsCompleted(globalFeedback = null) {
  try {
    const response = await fetch('/.netlify/functions/mark-attempt-completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: authenticationData.student.id,
        worksheetId: authenticationData.worksheet.id,
        attemptNumber: authenticationData.session.current_attempt,
        globalFeedback: globalFeedback,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Eroare la marcarea finalizării');
    }

    console.log('Încercarea marcată ca finalizată cu succes');
    authenticationData.session.last_attempt_completed = true;
  } catch (error) {
    console.error('Eroare marcare attempt ca finalizat:', error);
    throw error;
  }
}

// Cere raportul AI final
async function requestFinalAIReport(totalScore, maxScore, exerciseConfig) {
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
    const response = await fetch(
      '/.netlify/functions/worksheet-submit-religie-IX-respectul-fata-de-cele-sfinte',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'final_report',
          student: studentData,
          performanceData: performanceData,
          allStepsData: worksheetSteps,
          exerciseConfig: exerciseConfig,
        }),
      }
    );

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
    showMessage('AI analizează cunoștințele despre sfințenie...', 'info');
  } else {
    finishBtn.classList.remove('loading');
  }
}

// Afișează completarea cu raport AI
function displayCompletionWithAIReport(totalScore, maxScore, aiReport, exerciseConfig) {
  document.getElementById('worksheet-section').classList.add('hidden');
  document.getElementById('completion-section').classList.remove('hidden');

  const scoreElement = document.getElementById('final-score');

  if (exerciseConfig.has_scoring) {
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    scoreElement.innerHTML = `
      <div class="score-display">
        <span class="score-value">${totalScore}/${maxScore} puncte</span>
        <span class="score-percent">(${percentage.toFixed(1)}%)</span>
      </div>
    `;

    scoreElement.className = 'final-score';
    if (percentage >= 80) scoreElement.classList.add('excellent');
    else if (percentage >= 60) scoreElement.classList.add('good');
    else scoreElement.classList.add('needs-improvement');
  } else {
    scoreElement.innerHTML = `
      <div class="completion-display">
        <span class="completion-value">Activitate completată cu succes!</span>
        <span class="steps-completed">Toate cele ${worksheetSteps.length} etape finalizate</span>
      </div>
    `;
    scoreElement.className = 'final-completion';
  }

  const feedbackElement = document.getElementById('final-feedback');
  feedbackElement.innerHTML = `
    <div class="ai-final-report">
      <h4>Raport final - Respectul față de cele sfinte</h4>
      <div class="ai-report-content">${formatFeedbackText(aiReport)}</div>
    </div>
  `;

  addCompletionActionButtons();
}

// Adaugă butoanele de acțiune
function addCompletionActionButtons() {
  let actionsContainer = document.getElementById('completion-actions');
  if (!actionsContainer) {
    actionsContainer = document.createElement('div');
    actionsContainer.id = 'completion-actions';
    actionsContainer.className = 'completion-actions';
    document.getElementById('completion-section').appendChild(actionsContainer);
  }

  actionsContainer.innerHTML = '';

  const canStartNew =
    authenticationData.session.current_attempt < authenticationData.worksheet.max_attempts;

  if (canStartNew) {
    const retryButton = document.createElement('button');
    retryButton.className = 'action-btn retry-btn';
    retryButton.textContent = 'Refă exercițiul';
    retryButton.onclick = handleRetryExercise;
    actionsContainer.appendChild(retryButton);
  }

  const homeButton = document.createElement('button');
  homeButton.className = 'action-btn home-btn';
  homeButton.textContent = 'Înapoi la pagina principală';
  homeButton.onclick = handleGoHome;
  actionsContainer.appendChild(homeButton);

  const reviewButton = document.createElement('button');
  reviewButton.className = 'action-btn review-btn secondary';
  reviewButton.textContent = 'Vezi toate răspunsurile';
  reviewButton.onclick = displayWorksheetReview;
  actionsContainer.appendChild(reviewButton);

  if (!canStartNew) {
    const infoMessage = document.createElement('div');
    infoMessage.className = 'completion-info';
    infoMessage.innerHTML = `
      <p><strong>Ai folosit toate încercările disponibile (${authenticationData.worksheet.max_attempts}/${authenticationData.worksheet.max_attempts})</strong></p>
      <p>Poți vedea răspunsurile tale sau să te întorci la pagina principală pentru alte activități.</p>
    `;
    actionsContainer.insertBefore(infoMessage, actionsContainer.firstChild);
  }
}

// Gestionează reluarea exercițiului
async function handleRetryExercise() {
  showConfirmModal(
    'Refaci exercițiul?',
    'Sigur vrei să refaci exercițiul? Vei începe de la zero și vei pierde progresul actual.',
    async () => {
      const retryBtn = document.querySelector('.retry-btn');
      const originalText = retryBtn.textContent;
      retryBtn.disabled = true;
      retryBtn.textContent = 'Se pregătește exercițiul...';

      try {
        await startNewAttempt();
        document.getElementById('completion-section').classList.add('hidden');
        document.getElementById('worksheet-section').classList.remove('hidden');
        showMessage('Exercițiu resetat cu succes! Poți începe din nou.', 'success');
      } catch (error) {
        console.error('Eroare la reluarea exercițiului:', error);
        showMessage('Eroare la reluarea exercițiului. Încearcă din nou.', 'error');
        retryBtn.disabled = false;
        retryBtn.textContent = originalText;
      }
    },
    'Da, refă exercițiul',
    'Anulează'
  );
}

// Gestionează întoarcerea acasă
function handleGoHome() {
  showConfirmModal(
    'Părăsești activitatea?',
    'Sigur vrei să părăsești această activitate și să te întorci la pagina principală?',
    () => {
      window.location.href = '/index.html';
    },
    'Da, pleacă',
    'Rămâi aici'
  );
}

// Review mode
function displayWorksheetReview() {
  document.getElementById('completion-section').classList.add('hidden');
  document.getElementById('worksheet-section').classList.remove('hidden');

  worksheetSteps.forEach((_, index) => {
    const stepElement = document.querySelector(`[data-step-index="${index}"]`);
    if (stepElement) {
      stepElement.classList.remove('hidden');
      stepElement.classList.add('review-mode');

      const controls = stepElement.querySelectorAll('input, textarea, button');
      controls.forEach((control) => (control.disabled = true));
    }
  });

  const navigation = document.querySelector('.navigation');
  navigation.innerHTML = `
    <button onclick="returnToResults()" class="nav-btn primary">
      Înapoi la rezultate
    </button>
  `;

  showMessage('Mod review: toate răspunsurile și feedback-urile', 'info');
}

// Întoarcere la rezultate
function returnToResults() {
  document.getElementById('worksheet-section').classList.add('hidden');
  document.getElementById('completion-section').classList.remove('hidden');
}
