// js/common.js
// Funcții comune: autentificare, navigare, helpers, validări

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
  authBtn.disabled = true;
  authBtn.textContent = 'Se verifică...';
  loadingDiv.classList.remove('hidden');
  errorDiv.classList.add('hidden');

  try {
    const response = await fetch('/api/authenticate', {
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
    authBtn.disabled = false;
    authBtn.textContent = 'Intră în activitate';
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

// Verifică statusul worksheet-ului și afișează secțiunea corespunzătoare
function checkWorksheetStatus(authData) {
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

// Afișează modul read-only
function showReadOnlyMode(authData) {
  document.getElementById('readonly-section').classList.remove('hidden');
  populateWorksheetHeader(authData);

  // TODO: Implementează afișarea progresului în mod read-only
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

// Funcție pentru trimiterea unui pas către server
async function submitStepToServer(stepIndex, answer) {
  if (!authenticationData) {
    showMessage('Date de autentificare lipsă', 'error');
    return false;
  }

  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  // UI loading state
  submitBtn.disabled = true;
  submitBtn.textContent = 'Se trimite...';

  try {
    const response = await fetch('/api/submit-step', {
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
      // Marchează pasul ca fiind completat
      studentProgress[stepIndex] = {
        completed: true,
        answer: answer,
        feedback: data.feedback,
        score: data.score,
      };

      // Afișează feedback-ul
      showStepFeedback(stepIndex, data.feedback, data.score);

      // Actualizează navigarea
      updateNavigation();
      updateProgressDisplay();

      showMessage(data.message || 'Răspuns trimis cu succes!', 'success');
      return true;
    } else {
      showMessage(data.error || 'Eroare la trimiterea răspunsului', 'error');
      return false;
    }
  } catch (error) {
    console.error('Eroare submit step:', error);
    showMessage('Eroare de conexiune. Încearcă din nou.', 'error');
    return false;
  } finally {
    // Resetare UI
    submitBtn.disabled = false;
    submitBtn.textContent = 'Trimite răspunsul';
  }
}

// Afișează feedback-ul pentru un pas
function showStepFeedback(stepIndex, feedback, score) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const feedbackContainer = stepElement.querySelector('.feedback');
  const scoreElement = stepElement.querySelector('.feedback-score');
  const textElement = stepElement.querySelector('.feedback-text');
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  // Populează feedback-ul
  if (scoreElement) scoreElement.textContent = `Punctaj: ${score}`;
  if (textElement) textElement.textContent = feedback;

  // Afișează feedback-ul
  if (feedbackContainer) {
    feedbackContainer.classList.remove('hidden');
  }

  // Dezactivează submit-ul pentru acest pas
  if (submitBtn) {
    submitBtn.textContent = 'Completat';
    submitBtn.disabled = true;
    submitBtn.classList.add('completed');
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

// Funcție pentru actualizarea contorului de cuvinte
function updateWordCount(textarea, wordCountElement) {
  const text = textarea.value.trim();
  const wordCount = text === '' ? 0 : text.split(/\s+/).length;

  if (wordCountElement) {
    wordCountElement.textContent = `${wordCount} cuvinte`;

    if (wordCount >= 10) {
      wordCountElement.classList.add('sufficient');
    } else {
      wordCountElement.classList.remove('sufficient');
    }
  }
}
