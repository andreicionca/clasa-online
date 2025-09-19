// js/common.js
// Funcții JavaScript comune pentru construirea UI-ului dinamic

// Funcția principală pentru inițializarea worksheet-ului după autentificare
function initializeWorksheet() {
  if (!authData) {
    console.error('Nu există date de autentificare');
    return;
  }

  // Ascunde secțiunea de autentificare
  document.getElementById('auth-section').classList.add('hidden');

  // Verifică statusul worksheet-ului
  if (!authData.worksheet.is_active) {
    showReadOnlyMode();
    return;
  }

  if (!authData.session.can_submit) {
    showMaxAttemptsReached();
    return;
  }

  // Afișează secțiunea principală
  document.getElementById('worksheet-section').classList.remove('hidden');

  // Populează header-ul
  populateWorksheetHeader();

  // Inițializează pașii
  initializeSteps();

  // Încarcă progresul existent sau începe de la primul pas
  loadProgress();

  // Afișează primul pas
  showStep(currentStepIndex);
}

// Populează informațiile din header
function populateWorksheetHeader() {
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

// Inițializează structura pașilor
function initializeSteps() {
  stepsData = authData.worksheet.structure.steps || [];

  // Actualizează numărul total de pași
  document.getElementById('total-steps').textContent = stepsData.length;

  // Construiește container-ul pentru pași
  buildStepsContainer();

  // Inițializează progresul pentru fiecare pas
  studentProgress = {};
  stepsData.forEach((_, index) => {
    studentProgress[index] = {
      completed: false,
      answer: null,
      feedback: null,
      score: 0,
    };
  });
}

// Construiește container-ul HTML pentru toți pașii
function buildStepsContainer() {
  const container = document.getElementById('steps-container');
  container.innerHTML = '';

  stepsData.forEach((stepData, index) => {
    const stepElement = createStepElement(stepData, index);
    container.appendChild(stepElement);
  });
}

// Creează elementul HTML pentru un pas
function createStepElement(stepData, stepIndex) {
  const templateId = stepData.type === 'grila' ? 'grila-step-template' : 'short-step-template';
  const template = document.getElementById(templateId);
  const stepElement = template.content.cloneNode(true);

  // Setează numărul pasului
  const stepDiv = stepElement.querySelector('.step');
  stepDiv.dataset.stepIndex = stepIndex;
  stepDiv.classList.add('hidden'); // Inițial ascuns

  // Populează numărul pasului
  stepElement.querySelector('.step-number').textContent = stepIndex + 1;

  // Populează întrebarea
  stepElement.querySelector('.question-text').textContent = stepData.question;

  if (stepData.type === 'grila') {
    buildGrilaOptions(stepElement, stepData, stepIndex);
  } else if (stepData.type === 'short') {
    buildShortAnswer(stepElement, stepIndex);
  }

  return stepElement;
}

// Construiește opțiunile pentru întrebările cu grile
function buildGrilaOptions(stepElement, stepData, stepIndex) {
  const optionsContainer = stepElement.querySelector('.options');
  optionsContainer.dataset.step = stepIndex;

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

// Configurează textarea pentru răspunsuri scurte
function buildShortAnswer(stepElement, stepIndex) {
  const textarea = stepElement.querySelector('.short-answer');
  const wordCount = stepElement.querySelector('.word-count');

  textarea.dataset.step = stepIndex;

  // Event listener pentru numărarea cuvintelor și activarea butonului
  textarea.addEventListener('input', () => {
    updateWordCount(textarea, wordCount);
    enableSubmitButton(stepIndex);
  });
}

// Actualizează contorul de cuvinte pentru răspunsuri scurte
function updateWordCount(textarea, wordCountElement) {
  const text = textarea.value.trim();
  const wordCount = text === '' ? 0 : text.split(/\s+/).length;

  wordCountElement.textContent = `${wordCount} cuvinte`;

  if (wordCount >= 10) {
    wordCountElement.classList.add('sufficient');
  } else {
    wordCountElement.classList.remove('sufficient');
  }
}

// Activează butonul de submit pentru un pas
function enableSubmitButton(stepIndex) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const submitBtn = stepElement.querySelector('.submit-step-btn');

  if (isStepAnswered(stepIndex)) {
    submitBtn.disabled = false;
    submitBtn.classList.add('enabled');
  } else {
    submitBtn.disabled = true;
    submitBtn.classList.remove('enabled');
  }
}

// Verifică dacă un pas are răspuns valid
function isStepAnswered(stepIndex) {
  const stepData = stepsData[stepIndex];
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);

  if (stepData.type === 'grila') {
    const selectedOption = stepElement.querySelector('input[type="radio"]:checked');
    return selectedOption !== null;
  } else if (stepData.type === 'short') {
    const textarea = stepElement.querySelector('.short-answer');
    return textarea.value.trim().length >= 5; // Minim 5 caractere
  }

  return false;
}

// Încarcă progresul existent
function loadProgress() {
  if (authData.session.progress && authData.session.progress.length > 0) {
    authData.session.progress.forEach((progressItem) => {
      const stepIndex = progressItem.step_number - 1; // Convertire la index 0-based

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
    });

    // Setează pasul curent la primul pas necompletat
    currentStepIndex = findNextIncompleteStep();
  }
}

// Găsește următorul pas necompletat
function findNextIncompleteStep() {
  for (let i = 0; i < stepsData.length; i++) {
    if (!studentProgress[i].completed) {
      return i;
    }
  }
  return stepsData.length - 1; // Toate sunt completate, rămâne la ultimul
}

// Populează răspunsul unui pas în interfață
function populateStepAnswer(stepIndex, answer) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const stepData = stepsData[stepIndex];

  if (stepData.type === 'grila' && typeof answer === 'number') {
    const radio = stepElement.querySelector(`input[value="${answer}"]`);
    if (radio) {
      radio.checked = true;
    }
  } else if (stepData.type === 'short' && typeof answer === 'string') {
    const textarea = stepElement.querySelector('.short-answer');
    if (textarea) {
      textarea.value = answer;
      updateWordCount(textarea, stepElement.querySelector('.word-count'));
    }
  }
}

// Afișează feedback-ul pentru un pas
function showStepFeedback(stepIndex, feedback, score) {
  const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
  const feedbackContainer = stepElement.querySelector('.feedback');
  const scoreElement = stepElement.querySelector('.feedback-score');
  const textElement = stepElement.querySelector('.feedback-text');

  scoreElement.textContent = `Punctaj: ${score}`;
  textElement.textContent = feedback;

  feedbackContainer.classList.remove('hidden');

  // Dezactivează submit-ul pentru acest pas
  const submitBtn = stepElement.querySelector('.submit-step-btn');
  submitBtn.textContent = 'Completat';
  submitBtn.disabled = true;
  submitBtn.classList.add('completed');
}

// Afișează un pas specific
function showStep(stepIndex) {
  // Ascunde toate pașii
  document.querySelectorAll('.step').forEach((step) => {
    step.classList.add('hidden');
  });

  // Afișează pasul curent
  const currentStep = document.querySelector(`[data-step-index="${stepIndex}"]`);
  if (currentStep) {
    currentStep.classList.remove('hidden');
  }

  // Actualizează UI-ul de navigare
  updateNavigation();
  updateProgressBar();

  // Actualizează numărul pasului curent
  document.getElementById('current-step').textContent = stepIndex + 1;
}

// Actualizează butoanele de navigare
function updateNavigation() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const finishBtn = document.getElementById('finish-btn');

  // Butonul Previous
  prevBtn.disabled = currentStepIndex === 0;

  // Butonul Next
  const isLastStep = currentStepIndex === stepsData.length - 1;
  const currentCompleted = studentProgress[currentStepIndex].completed;

  nextBtn.disabled = !currentCompleted || isLastStep;

  // Butonul Finish
  const allCompleted = Object.values(studentProgress).every((p) => p.completed);

  if (isLastStep && allCompleted) {
    nextBtn.classList.add('hidden');
    finishBtn.classList.remove('hidden');
  } else {
    nextBtn.classList.remove('hidden');
    finishBtn.classList.add('hidden');
  }
}

// Actualizează progress bar-ul
function updateProgressBar() {
  const completedSteps = Object.values(studentProgress).filter((p) => p.completed).length;
  const progressPercentage = (completedSteps / stepsData.length) * 100;

  document.getElementById('progress-fill').style.width = `${progressPercentage}%`;
}

// Afișează modul read-only
function showReadOnlyMode() {
  document.getElementById('readonly-section').classList.remove('hidden');

  // Implementare pentru afișarea progresului în mod read-only
  // Această parte va fi dezvoltată ulterior
}

// Afișează mesaj pentru numărul maxim de încercări
function showMaxAttemptsReached() {
  const worksheetSection = document.getElementById('worksheet-section');
  worksheetSection.classList.remove('hidden');

  const messagesDiv = document.getElementById('worksheet-messages');
  messagesDiv.innerHTML = `
        <div class="message warning">
            <h3>Numărul maxim de încercări a fost atins</h3>
            <p>Ai folosit toate cele ${authData.worksheet.max_attempts} încercări disponibile pentru această activitate.</p>
        </div>
    `;

  populateWorksheetHeader();
  // Afișează progresul ultimei încercări în mod read-only
  loadProgress();
  showReadOnlyProgress();
}

// Afișează progresul în mod read-only
function showReadOnlyProgress() {
  // Implementare pentru afișarea progresului fără posibilitate de editare
  // Această parte va fi dezvoltată ulterior
}

// Funcții de navigare
function nextStep() {
  if (currentStepIndex < stepsData.length - 1 && studentProgress[currentStepIndex].completed) {
    currentStepIndex++;
    showStep(currentStepIndex);
  }
}

function previousStep() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    showStep(currentStepIndex);
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

function clearMessages() {
  document.getElementById('worksheet-messages').innerHTML = '';
}
