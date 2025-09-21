// js/common.js
// Funcții comune refactorizate: autentificare, navigare, UI states, retry logic

// Funcția de inițializare a paginii
function initializePage() {
  // Verifică dacă există cod salvat în localStorage
  const savedCode = localStorage.getItem('studentCode');
  if (savedCode) {
    document.getElementById('student-code').value = savedCode;
  }

  // Event listeners pentru Enter key
  document.getElementById('student-code').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') performAuthentication();
  });

  document.getElementById('worksheet-password').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') performAuthentication();
  });
}

// Funcția principală de autentificare
async function performAuthentication() {
  const studentCode = document.getElementById('student-code').value.trim();
  const worksheetPassword = document.getElementById('worksheet-password').value.trim();
  const errorDiv = document.getElementById('auth-error');
  const loadingDiv = document.getElementById('auth-loading');
  const authBtn = document.getElementById('auth-btn');

  // Validare input
  if (!studentCode || !worksheetPassword) {
    showError('Completează ambele câmpuri', 'auth-error');
    return;
  }

  // UI loading state
  setAuthLoadingState(authBtn, loadingDiv, errorDiv, true);

  try {
    const response = await fetch('/.netlify/functions/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentCode: studentCode,
        worksheetPassword: worksheetPassword,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Salvează codul în localStorage
      localStorage.setItem('studentCode', studentCode);

      // Ascunde secțiunea de autentificare
      document.getElementById('auth-section').classList.add('hidden');

      // Apelează callback-ul pentru succes
      if (typeof onAuthenticationSuccess === 'function') {
        onAuthenticationSuccess(data);
      } else {
        console.error('Callback onAuthenticationSuccess nu este definit');
      }
    } else {
      showError(data.error || 'Eroare de autentificare', 'auth-error');
    }
  } catch (error) {
    showError('Eroare de conexiune. Încearcă din nou.', 'auth-error');
    console.error('Eroare autentificare:', error);
  } finally {
    // Resetare UI
    setAuthLoadingState(authBtn, loadingDiv, errorDiv, false);
  }
}

// Helper pentru UI states în autentificare
function setAuthLoadingState(button, loadingDiv, errorDiv, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.textContent = 'Se verifică...';
    loadingDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  } else {
    button.disabled = false;
    button.textContent = 'Intră în activitate';
    loadingDiv.classList.add('hidden');
  }
}

// Funcții de navigare
function moveToNextStep() {
  if (currentStepIndex < worksheetSteps.length - 1 && isCurrentStepCompleted()) {
    currentStepIndex++;
    showCurrentStep();
    updateNavigation();
  }
}

function moveToPreviousStep() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    showCurrentStep();
    updateNavigation();
  }
}

// Verifică dacă pasul curent este completat
function isCurrentStepCompleted() {
  return studentProgress[currentStepIndex] && studentProgress[currentStepIndex].completed;
}

// Afișează pasul curent
function showCurrentStep() {
  // Ascunde toate pașii
  document.querySelectorAll('.step').forEach((step) => {
    step.classList.add('hidden');
  });

  // Afișează pasul curent
  const currentStep = document.querySelector(`[data-step-index="${currentStepIndex}"]`);
  if (currentStep) {
    currentStep.classList.remove('hidden');
  }

  // Actualizează UI-ul
  updateProgressDisplay();
}

// Actualizează afișajul progresului
function updateProgressDisplay() {
  // Actualizează numărul pasului curent
  document.getElementById('current-step').textContent = currentStepIndex + 1;

  // Actualizează progress bar-ul
  const completedSteps = Object.values(studentProgress).filter((p) => p && p.completed).length;
  const progressPercentage = (completedSteps / worksheetSteps.length) * 100;
  document.getElementById('progress-fill').style.width = `${progressPercentage}%`;
}

// Actualizează butoanele de navigare
function updateNavigation() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const finishBtn = document.getElementById('finish-btn');

  // Butonul Previous
  prevBtn.disabled = currentStepIndex === 0;

  // Butonul Next
  const isLastStep = currentStepIndex === worksheetSteps.length - 1;
  const currentCompleted = isCurrentStepCompleted();

  nextBtn.disabled = !currentCompleted || isLastStep;

  // Butonul Finish
  const allCompleted = Object.values(studentProgress).every((p) => p && p.completed);

  if (isLastStep && allCompleted) {
    nextBtn.classList.add('hidden');
    finishBtn.classList.remove('hidden');
  } else {
    nextBtn.classList.remove('hidden');
    finishBtn.classList.add('hidden');
  }
}

// Populează header-ul worksheet-ului
function populateWorksheetHeader(authData) {
  const studentName = `${authData.student.name} ${authData.student.surname}`;
  const worksheetTitle = `${
    authData.worksheet.title
  } - ${authData.worksheet.subject.toUpperCase()}`;

  document.getElementById('student-name').textContent = studentName;
  document.getElementById('worksheet-title').textContent = worksheetTitle;

  const statusText = authData.worksheet.is_active
    ? `Încercarea ${authData.session.current_attempt}/${authData.worksheet.max_attempts}`
    : 'Activitate închisă';

  document.getElementById('worksheet-status').textContent = statusText;
}

// MODIFICAT: Verifică statusul worksheet-ului și afișează secțiunea corespunzătoare
function checkWorksheetStatus(authData) {
  // NOUĂ VERIFICARE: Dacă trebuie să afișezi informațiile despre încercarea anterioară
  if (authData.session.show_previous_attempt_info) {
    showPreviousAttemptInfo(authData);
    return false; // Nu afișa worksheet-ul direct
  }

  if (!authData.worksheet.is_active) {
    showReadOnlyMode(authData);
    return false;
  }

  if (!authData.session.can_submit) {
    showMaxAttemptsReached(authData);
    return false;
  }

  // Afișează secțiunea principală
  document.getElementById('worksheet-section').classList.remove('hidden');
  populateWorksheetHeader(authData);
  return true;
}

// NOUĂ FUNCȚIE: Afișează informațiile despre încercarea anterioară
function showPreviousAttemptInfo(authData) {
  const previousSection = document.getElementById('previous-attempt-section');
  if (!previousSection) {
    console.error('Secțiunea previous-attempt-section nu a fost găsită în HTML');
    return;
  }

  // Populează informațiile de bază
  populatePreviousAttemptHeader(authData);

  // Populează scorul anterior
  populatePreviousScore(authData);

  // Populează raportul anterior
  populatePreviousReport(authData);

  // Populează opțiunile disponibile
  populatePreviousAttemptOptions(authData);

  // Afișează secțiunea
  previousSection.classList.remove('hidden');

  console.log('Secțiunea pentru încercarea anterioară afișată cu succes');
}

// NOUĂ FUNCȚIE: Populează header-ul pentru încercarea anterioară
function populatePreviousAttemptHeader(authData) {
  const studentName = `${authData.student.name} ${authData.student.surname}`;
  const worksheetTitle = `${
    authData.worksheet.title
  } - ${authData.worksheet.subject.toUpperCase()}`;

  // Populează numele studentului și titlul activității
  const prevStudentName = document.getElementById('prev-student-name');
  const prevWorksheetTitle = document.getElementById('prev-worksheet-title');

  if (prevStudentName) prevStudentName.textContent = studentName;
  if (prevWorksheetTitle) prevWorksheetTitle.textContent = worksheetTitle;

  // Populează detaliile încercării
  const attemptDetails = document.getElementById('prev-attempt-details');
  if (attemptDetails && authData.previous_attempt) {
    const completedDate = new Date(authData.previous_attempt.completed_at).toLocaleDateString(
      'ro-RO',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );

    attemptDetails.textContent = `Încercarea ${authData.previous_attempt.attempt_number} - completată pe ${completedDate}`;
  }
}

// NOUĂ FUNCȚIE: Populează scorul anterior
function populatePreviousScore(authData) {
  const previousScoreElement = document.getElementById('previous-score');
  if (!previousScoreElement || !authData.previous_attempt) return;

  const { total_score, max_score } = authData.previous_attempt;
  const percentage = (total_score / max_score) * 100;

  previousScoreElement.innerHTML = `
    <div class="previous-score-display">
      <span class="score-value">${total_score}/${max_score} puncte</span>
      <span class="score-percent">(${percentage.toFixed(1)}%)</span>
    </div>
  `;

  // Adaugă clasa CSS pe baza performanței
  if (percentage >= 80) {
    previousScoreElement.classList.add('excellent');
  } else if (percentage >= 60) {
    previousScoreElement.classList.add('good');
  } else {
    previousScoreElement.classList.add('needs-improvement');
  }
}

// NOUĂ FUNCȚIE: Populează raportul anterior
function populatePreviousReport(authData) {
  const previousReportElement = document.getElementById('previous-report');
  if (!previousReportElement || !authData.previous_attempt) return;

  const globalFeedback = authData.previous_attempt.global_feedback;

  if (globalFeedback) {
    previousReportElement.innerHTML = `
      <div class="previous-ai-report">
        <div class="ai-report-content">${globalFeedback}</div>
      </div>
    `;
  } else {
    previousReportElement.innerHTML = `
      <div class="no-report-message">
        <p>Raportul AI nu a fost salvat pentru această încercare.</p>
      </div>
    `;
  }
}

// NOUĂ FUNCȚIE: Populează opțiunile pentru încercarea anterioară
function populatePreviousAttemptOptions(authData) {
  const retryInfoText = document.getElementById('retry-info-text');
  const retryButton = document.getElementById('retry-exercise-btn');

  if (!retryInfoText || !retryButton) return;

  const attemptsRemaining = authData.worksheet.max_attempts - authData.session.current_attempt + 1;

  if (authData.session.can_start_new_attempt) {
    // Poate începe o încercare nouă
    retryButton.disabled = false;
    retryButton.classList.remove('disabled');

    retryInfoText.innerHTML = `
      Mai poți face încă <strong>${attemptsRemaining}</strong> ${
      attemptsRemaining === 1 ? 'încercare' : 'încercări'
    }
      la această activitate. Dacă refaci exercițiul, vei începe de la zero.
    `;
  } else {
    // Nu mai poate face încercări
    retryButton.disabled = true;
    retryButton.classList.add('disabled');
    retryButton.textContent = 'Nu mai poți reface exercițiul';

    retryInfoText.innerHTML = `
      Ai folosit toate cele <strong>${authData.worksheet.max_attempts}</strong> încercări disponibile
      pentru această activitate.
    `;
  }
}

// NOUĂ FUNCȚIE: Începe o încercare nouă din secțiunea anterioară
async function startNewAttemptFromPrevious() {
  const retryBtn = document.getElementById('retry-exercise-btn');
  if (!retryBtn) return;

  // UI loading state
  const originalText = retryBtn.textContent;
  retryBtn.disabled = true;
  retryBtn.textContent = 'Se pregătește exercițiul...';

  try {
    // Apelează funcția existentă pentru reset complet
    await startNewAttempt();

    // Ascunde secțiunea anterioară și afișează worksheet-ul
    document.getElementById('previous-attempt-section').classList.add('hidden');
    document.getElementById('worksheet-section').classList.remove('hidden');

    showMessage('Exercițiu nou început! Poți începe din nou toate pașii.', 'success');
  } catch (error) {
    console.error('Eroare la începerea exercițiului nou din secțiunea anterioară:', error);
    showMessage('Eroare la începerea exercițiului nou. Încearcă din nou.', 'error');

    // Restaurează butonul
    retryBtn.disabled = false;
    retryBtn.textContent = originalText;
  }
}

// Afișează modul read-only
function showReadOnlyMode(authData) {
  document.getElementById('readonly-section').classList.remove('hidden');
  populateWorksheetHeader(authData);
  showMessage('Această activitate a fost închisă. Poți vedea doar progresul anterior.', 'info');
}

// Afișează mesaj pentru numărul maxim de încercări
function showMaxAttemptsReached(authData) {
  const worksheetSection = document.getElementById('worksheet-section');
  worksheetSection.classList.remove('hidden');

  const messagesDiv = document.getElementById('worksheet-messages');
  messagesDiv.innerHTML = `
    <div class="message warning">
      <h3>Numărul maxim de încercări a fost atins</h3>
      <p>Ai folosit toate cele ${authData.worksheet.max_attempts} încercări disponibile pentru această activitate.</p>
    </div>
  `;

  populateWorksheetHeader(authData);
}

// Inițializează tracking-ul progresului cu logica condițională
function initializeProgressTracking(authData, shouldRestoreInUI = null) {
  // Folosește flag-ul din authenticate.js dacă nu e specificat manual
  const shouldRestore =
    shouldRestoreInUI !== null ? shouldRestoreInUI : authData.session.should_restore_progress;

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

  // Încarcă progresul existent DOAR dacă este cazul
  if (shouldRestore && authData.session.progress && authData.session.progress.length > 0) {
    restoreExistingProgress(authData.session.progress);
    console.log('Progres restaurat pentru continuarea exercițiului');
  } else {
    console.log('Exercițiu curat - nu se încarcă progresul anterior');
  }
}

// Restaurează progresul din baza de date (rămâne neschimbată)
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

// Începe o încercare nouă (resetează totul)
async function startNewAttempt() {
  if (!authenticationData) {
    showMessage('Date de autentificare lipsă', 'error');
    return;
  }

  try {
    // Creează o nouă încercare în baza de date prin incrementarea attempt-ului
    const newAttemptNumber = authenticationData.session.current_attempt + 1;

    // Actualizează datele locale
    authenticationData.session.current_attempt = newAttemptNumber;
    authenticationData.session.progress = null; // Șterge progresul anterior

    // Resetează complet interfața
    resetWorksheetInterface();

    // Reinițializează progresul fără restaurare
    initializeProgressTracking(authenticationData, false);

    // Navighează la primul pas
    navigateToFirstAvailableStep();

    // Actualizează header-ul cu noul număr de încercare
    populateWorksheetHeader(authenticationData);

    // Afișează mesajul de succes
    showMessage(
      `Încercare nouă începută (${newAttemptNumber}/${authenticationData.worksheet.max_attempts})`,
      'success'
    );

    console.log('Încercare nouă începută:', newAttemptNumber);
  } catch (error) {
    console.error('Eroare la începerea încercării noi:', error);
    showMessage('Eroare la începerea încercării noi. Încearcă din nou.', 'error');
  }
}

// Resetează complet interfața worksheet-ului
function resetWorksheetInterface() {
  // Șterge toate mesajele
  clearMessages();

  // Resetează toate pașii la starea inițială
  document.querySelectorAll('.step').forEach((stepElement) => {
    // Reactivează toate controalele
    const inputs = stepElement.querySelectorAll('input, textarea');
    inputs.forEach((input) => {
      input.disabled = false;
      if (input.type === 'radio') {
        input.checked = false;
      } else if (input.tagName === 'TEXTAREA') {
        input.value = '';
      }
    });

    // Resetează butoanele de submit
    const submitBtn = stepElement.querySelector('.submit-step-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Trimite răspunsul';
      submitBtn.classList.remove('completed', 'loading', 'error');
    }

    // Ascunde feedback-ul
    const feedbackContainer = stepElement.querySelector('.feedback');
    if (feedbackContainer) {
      feedbackContainer.classList.add('hidden');
    }

    // Resetează word count pentru textarea-uri
    const wordCountDiv = stepElement.querySelector('.word-count');
    if (wordCountDiv) {
      wordCountDiv.textContent = '0 cuvinte';
      wordCountDiv.className = 'word-count empty';
    }

    // Șterge clasa de pas completat
    stepElement.classList.remove('step-completed');
  });

  // Resetează navigarea
  currentStepIndex = 0;

  console.log('Interfață worksheet resetată complet');
}

// Navighează la primul pas disponibil (pentru exercițiu curat)
function navigateToFirstAvailableStep() {
  // Pentru exercițiu curat, începe mereu de la primul pas
  currentStepIndex = 0;

  // Afișează primul pas
  showCurrentStep();
  updateNavigation();
}

// Restaurează răspunsul unui pas în interfață (rămâne neschimbată)
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

  // Actualizează starea butonului și marchează ca completat
  updateSubmitButtonState(stepIndex);
  setStepCompletedState(stepElement);
}

// Funcție principală pentru trimiterea unui pas către server cu retry logic
async function submitStepToServer(stepIndex, answer) {
  if (!authenticationData) {
    showMessage('Date de autentificare lipsă', 'error');
    return false;
  }

  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  // Setează UI în stare de loading
  setStepSubmitLoadingState(stepElement, true);

  try {
    const response = await fetch('/.netlify/functions/submit-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: authenticationData.student.id,
        worksheetId: authenticationData.worksheet.id,
        stepNumber: stepIndex + 1, // Convert to 1-based
        answer: answer,
        attemptNumber: authenticationData.session.current_attempt,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Succés - marchează pasul ca completat permanent
      studentProgress[stepIndex] = {
        completed: true,
        answer: answer,
        feedback: data.feedback,
        score: data.score,
      };

      // Afișează feedback-ul și marchează UI-ul ca completat
      showStepFeedback(stepIndex, data.feedback, data.score, data.maxPoints);
      setStepCompletedState(stepElement);

      // Actualizează navigarea și progresul
      updateNavigation();
      updateProgressDisplay();

      showMessage(data.message || 'Răspuns evaluat cu succes!', 'success');
      return true;
    } else {
      // Eroare de la server
      setStepSubmitErrorState(stepElement, data.error);

      // Verifică dacă e retry-able
      if (data.retryable) {
        showRetryMessage(stepIndex, data.error);
      } else {
        showMessage(data.error || 'Eroare la trimiterea răspunsului', 'error');
      }
      return false;
    }
  } catch (error) {
    console.error('Eroare de rețea în submit step:', error);
    setStepSubmitErrorState(stepElement, 'Eroare de conexiune');
    showRetryMessage(stepIndex, 'Eroare de conexiune. Te rugăm să încerci din nou.');
    return false;
  }
}

// Setează UI-ul în stare de loading pentru submit
function setStepSubmitLoadingState(stepElement, isLoading) {
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Se procesează cu AI...';
    submitBtn.classList.add('loading');

    // Dezactivează input-urile temporar
    const inputs = stepElement.querySelectorAll('input, textarea');
    inputs.forEach((input) => {
      input.disabled = true;
    });
  } else {
    submitBtn.classList.remove('loading');

    // Reactivează input-urile
    const inputs = stepElement.querySelectorAll('input, textarea');
    inputs.forEach((input) => {
      input.disabled = false;
    });
  }
}

// Setează UI-ul în stare de eroare pentru submit (dar permite retry)
function setStepSubmitErrorState(stepElement, errorMessage) {
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  submitBtn.disabled = false;
  submitBtn.textContent = 'Trimite răspunsul';
  submitBtn.classList.remove('loading');
  submitBtn.classList.add('error');

  // Afișează eroarea temporar
  setTimeout(() => {
    submitBtn.classList.remove('error');
  }, 3000);
}

// Setează UI-ul în stare de completat (permanent)
function setStepCompletedState(stepElement) {
  const submitBtn = stepElement.querySelector('.submit-step-btn');
  const inputs = stepElement.querySelectorAll('input, textarea');

  // Dezactivează permanent după succes
  submitBtn.disabled = true;
  submitBtn.textContent = 'Completat';
  submitBtn.classList.add('completed');
  submitBtn.classList.remove('loading', 'error');

  // Dezactivează input-urile permanent
  inputs.forEach((input) => {
    input.disabled = true;
  });

  // Adaugă clasa de completat la întregul pas
  stepElement.classList.add('step-completed');
}

// Afișează mesaj de retry cu buton
function showRetryMessage(stepIndex, errorMessage) {
  const messagesDiv = document.getElementById('worksheet-messages');
  const retryMessage = document.createElement('div');
  retryMessage.className = 'message retry';
  retryMessage.innerHTML = `
    <p>${errorMessage}</p>
    <button onclick="retryCurrentStep(${stepIndex})" class="retry-btn">
      Încearcă din nou
    </button>
  `;

  messagesDiv.appendChild(retryMessage);

  // Auto-remove după 10 secunde
  setTimeout(() => {
    retryMessage.remove();
  }, 10000);
}

// Funcție pentru retry manual
function retryCurrentStep(stepIndex) {
  // Șterge mesajele de retry
  const retryMessages = document.querySelectorAll('.message.retry');
  retryMessages.forEach((msg) => msg.remove());

  // Reactivează butonul și reîncearcă
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const submitBtn = stepElement.querySelector('.submit-step-btn');
  submitBtn.classList.remove('error');

  // Apelează din nou submit cu același răspuns
  const answer = getStepAnswer(stepIndex);
  if (answer !== null && answer !== undefined) {
    submitStepToServer(stepIndex, answer);
  }
}

// Afișează feedback-ul pentru un pas cu design îmbunătățit
function showStepFeedback(stepIndex, feedback, score, maxPoints) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const feedbackContainer = stepElement.querySelector('.feedback');
  const scoreElement = stepElement.querySelector('.feedback-score');
  const textElement = stepElement.querySelector('.feedback-text');

  // Populează feedback-ul
  if (scoreElement) {
    scoreElement.textContent = `Punctaj: ${score}/${maxPoints} puncte`;

    // Adaugă clasa CSS bazată pe performanță
    const percentage = (score / maxPoints) * 100;
    if (percentage >= 80) {
      scoreElement.classList.add('score-excellent');
    } else if (percentage >= 60) {
      scoreElement.classList.add('score-good');
    } else {
      scoreElement.classList.add('score-needs-improvement');
    }
  }

  if (textElement) {
    textElement.textContent = feedback;
  }

  // Afișează feedback-ul cu animație
  if (feedbackContainer) {
    feedbackContainer.classList.remove('hidden');
    feedbackContainer.classList.add('feedback-appear');
  }
}

// Utility functions
function showMessage(message, type = 'info') {
  const messagesDiv = document.getElementById('worksheet-messages');
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.textContent = message;

  messagesDiv.appendChild(messageEl);

  // Auto-remove după 5 secunde
  setTimeout(() => {
    messageEl.remove();
  }, 5000);
}

function showError(message, elementId) {
  const errorDiv = document.getElementById(elementId);
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

function clearMessages() {
  const messagesDiv = document.getElementById('worksheet-messages');
  if (messagesDiv) {
    messagesDiv.innerHTML = '';
  }
}

// Validări pentru diferite tipuri de răspunsuri
function isValidGrilaAnswer(stepIndex) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const selectedOption = stepElement.querySelector('input[type="radio"]:checked');
  return selectedOption !== null;
}

function isValidShortAnswer(stepIndex) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const textarea = stepElement.querySelector('.short-answer');
  return textarea && textarea.value.trim().length >= 5;
}

function getStepAnswer(stepIndex) {
  const stepData = worksheetSteps[stepIndex];
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);

  if (stepData.type === 'grila') {
    const selectedOption = stepElement.querySelector('input[type="radio"]:checked');
    return selectedOption ? parseInt(selectedOption.value) : null;
  } else if (stepData.type === 'short') {
    const textarea = stepElement.querySelector('.short-answer');
    return textarea ? textarea.value.trim() : null;
  }

  return null;
}

// Pentru validarea la submit (folosită din worksheet.js)
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

// Funcție pentru actualizarea contorului de cuvinte (doar numără, fără limite)
function updateWordCount(textarea, wordCountElement) {
  const text = textarea.value.trim();
  const wordCount = text === '' ? 0 : text.split(/\s+/).length;

  if (wordCountElement) {
    wordCountElement.textContent = `${wordCount} cuvinte`;

    // Adaugă clase CSS pentru styling, dar fără limite
    if (wordCount === 0) {
      wordCountElement.className = 'word-count empty';
    } else if (wordCount < 10) {
      wordCountElement.className = 'word-count few';
    } else if (wordCount < 50) {
      wordCountElement.className = 'word-count moderate';
    } else {
      wordCountElement.className = 'word-count many';
    }
  }
}
