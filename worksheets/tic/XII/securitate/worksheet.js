// worksheets/tic/XII/securitate/worksheet.js
// Logica specifică pentru activitatea "Securitate – Viruși, Antivirus, Firewall"
// Focusat pe răspunsuri scurte despre securitate informatică

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
    return; // Nu afișa punctaje pentru exerciții fără scoring
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

// Creează o sarcină folosind template-ul pentru răspuns scurt
function createStepFromTemplate(stepData, stepIndex) {
  const template = document.getElementById('short-step-template');

  if (!template) {
    console.error('Template-ul short-step-template nu a fost găsit');
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

  // Configurează zona de răspuns scurt
  setupShortStep(stepElement, stepData, stepIndex);

  return stepElement;
}

// Configurează o sarcină cu răspuns scurt - adaptată pentru securitate IT
function setupShortStep(stepElement, stepData, stepIndex) {
  const textarea = stepElement.querySelector('.short-answer');
  const wordCountDiv = stepElement.querySelector('.word-count');
  let lastLength = 0; // Pentru detectarea paste-ului prin lungime

  // Funcție pentru afișarea alarmei de paste - adaptată pentru TIC
  function showPasteAlarm(e, revertValue = null) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Salvează conținutul original (sau folosește valoarea de revert)
    const originalValue = revertValue !== null ? revertValue : textarea.value;
    const originalStyle = textarea.style.cssText;

    // Afișează alarma în textarea - tema de securitate
    textarea.value =
      '🔒 SECURITY ALERT: Încercare de copiere detectată! În securitatea informatică, originalitatea și cunoașterea autentică sunt esențiale. Nu copia răspunsuri! 🛡️';
    textarea.style.backgroundColor = '#ffe6e6';
    textarea.style.color = '#cc0000';
    textarea.style.fontWeight = 'bold';
    textarea.readOnly = true;

    // Revine la normal după 6 secunde
    setTimeout(() => {
      textarea.value = originalValue;
      textarea.style.cssText = originalStyle;
      textarea.readOnly = false;
      textarea.focus();
      lastLength = originalValue.length;
    }, 6000);
  }

  // Event listener pentru input - detectează paste prin lungime
  textarea.addEventListener('input', (e) => {
    const currentLength = textarea.value.length;
    const difference = currentLength - lastLength;

    // Dacă textul a crescut brusc cu mult (probabil paste)
    if (difference > 15) {
      const revertValue = textarea.value.substring(0, lastLength);
      showPasteAlarm(e, revertValue);
      return;
    }

    lastLength = currentLength;
    updateWordCount(textarea, wordCountDiv);
    updateSubmitButtonState(stepIndex);
  });

  // Blochează metodele tradiționale de paste
  textarea.addEventListener('paste', showPasteAlarm);
  textarea.addEventListener('drop', showPasteAlarm);
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      showPasteAlarm(e);
    }
  });

  // Event listener pentru Ctrl+Enter
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

  // Apelează funcția din common.js pentru submit
  submitStepToServer(currentStepIndex, answer);
}

// Extrage răspunsul din interfață
function extractStepAnswer(stepIndex) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const textarea = stepElement.querySelector('.short-answer');
  return textarea ? textarea.value.trim() : null;
}

// Finalizează worksheet-ul cu raport AI specializat pe securitate
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

    // Generează raportul AI final specializat pe securitate
    const finalReport = await requestFinalAIReport(totalScore, maxScore, exerciseConfig);

    if (!finalReport || !finalReport.success) {
      throw new Error(finalReport?.error || 'Raportul AI nu a putut fi generat');
    }

    // Marchează încercarea ca finalizată
    await markAttemptAsCompleted(finalReport.finalReport);

    // Afișează completarea cu raportul AI
    displayCompletionWithAIReport(totalScore, maxScore, finalReport.finalReport, exerciseConfig);

    showMessage('Activitatea de securitate finalizată cu raport AI complet!', 'success');
  } catch (error) {
    console.error('Eroare finalizare AI:', error);

    // Fallback fără AI
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
      'Activitatea de securitate a fost finalizată cu succes. Raportul AI detaliat nu este disponibil momentan, dar toate răspunsurile au fost evaluate individual.',
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

// Cere raportul AI final specializat pe securitate IT
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
    const response = await fetch('/.netlify/functions/worksheet-submit-tic-XII-securitate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'final_report',
        student: studentData,
        performanceData: performanceData,
        allStepsData: worksheetSteps,
        exerciseConfig: exerciseConfig,
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
    finishBtn.textContent = 'Se generează raportul de securitate...';
    finishBtn.classList.add('loading');
    showMessage('AI analizează cunoștințele despre securitatea IT...', 'info');
  } else {
    finishBtn.classList.remove('loading');
  }
}

// Afișează completarea adaptată pentru TIC
function displayCompletionWithAIReport(totalScore, maxScore, aiReport, exerciseConfig) {
  // Tranzitia UI
  document.getElementById('worksheet-section').classList.add('hidden');
  document.getElementById('completion-section').classList.remove('hidden');

  const scoreElement = document.getElementById('final-score');

  if (exerciseConfig.has_scoring) {
    // Pentru exerciții cu punctaje
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
    // Pentru exerciții fără punctaje
    scoreElement.innerHTML = `
      <div class="completion-display">
        <span class="completion-value">Activitate completată cu succes!</span>
        <span class="steps-completed">Toate cele ${worksheetSteps.length} întrebări finalizate</span>
      </div>
    `;
    scoreElement.className = 'final-completion';
  }

  // Afișează raportul AI
  const feedbackElement = document.getElementById('final-feedback');
  feedbackElement.innerHTML = `
    <div class="ai-final-report">
      <h4>🔒 Raport final - Securitate IT</h4>
      <div class="ai-report-content">${formatFeedbackText(aiReport)}</div>
    </div>
  `;

  // Adaugă butoanele de acțiune
  addCompletionActionButtons();
}

// Adaugă butoanele pentru acțiunile finale
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
    'Refaci exercițiul de securitate?',
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

// Review mode - afișează toate pașii
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

  showMessage('Mod review: toate răspunsurile și feedback-urile despre securitate', 'info');
}

// Întoarcere la rezultate din review
function returnToResults() {
  document.getElementById('worksheet-section').classList.add('hidden');
  document.getElementById('completion-section').classList.remove('hidden');
}
