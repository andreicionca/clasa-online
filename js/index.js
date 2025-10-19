// js/index.js - Dashboard functionality refactored

let dashboardData = null;

// Inițializare pagină
document.addEventListener('DOMContentLoaded', function () {
  initializeIndexPage();
});

function initializeIndexPage() {
  console.log('Dashboard încărcat');

  // Verifică dacă există cod salvat în localStorage
  const savedCode = localStorage.getItem('studentCode');
  if (savedCode) {
    document.getElementById('student-code').value = savedCode;
  }

  // Event listener pentru Enter key
  document.getElementById('student-code').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') loginStudent();
  });
}

// Funcția principală de login
async function loginStudent() {
  const studentCode = document.getElementById('student-code').value.trim();
  const errorDiv = document.getElementById('auth-error');
  const loadingDiv = document.getElementById('auth-loading');
  const authBtn = document.getElementById('auth-btn');

  // Validare input
  if (!studentCode) {
    showError('Introduceți codul elevului', errorDiv);
    return;
  }

  // UI loading state
  setLoadingState(authBtn, loadingDiv, errorDiv, true);

  try {
    const response = await fetch('/.netlify/functions/get-student-dashboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentCode: studentCode,
      }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('studentCode', studentCode);
      dashboardData = data;
      showDashboard();
    } else {
      showError(data.error || 'Cod invalid', errorDiv);
    }
  } catch (error) {
    showError('Eroare de conexiune. Încearcă din nou.', errorDiv);
    console.error('Eroare login:', error);
  } finally {
    setLoadingState(authBtn, loadingDiv, errorDiv, false);
  }
}

// Afișează dashboard-ul
function showDashboard() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');

  populateStudentInfo();
  populateOverallStats();
  populateWorksheetsBySubject();

  console.log('Dashboard afișat cu succes');
}

// Populează informațiile elevului în header
function populateStudentInfo() {
  const student = dashboardData.student;
  document.getElementById(
    'student-name-display'
  ).textContent = `${student.name} ${student.surname}`;
  document.getElementById('student-grade-display').textContent = `Clasa ${student.grade}`;
}

// Populează statisticile generale
function populateOverallStats() {
  const stats = dashboardData.overall_stats;

  // Puncte totale
  const totalPercentage =
    stats.total_points_possible > 0
      ? ((stats.total_points_earned / stats.total_points_possible) * 100).toFixed(1)
      : 0;
  document.getElementById(
    'total-score'
  ).textContent = `${stats.total_points_earned}/${stats.total_points_possible} (${totalPercentage}%)`;

  // Clasament
  if (stats.overall_rank) {
    document.getElementById('overall-rank').textContent = `Locul ${stats.overall_rank}`;
  } else {
    document.getElementById('overall-rank').textContent = '-';
  }

  // Procent completare
  document.getElementById('completion-rate').textContent = `${stats.completion_percentage}%`;

  // Progress bar bazat DOAR pe fișe completate
  const progressPercentage =
    stats.worksheets_total > 0 ? (stats.worksheets_completed / stats.worksheets_total) * 100 : 0;
  document.getElementById('overall-progress').style.width = `${progressPercentage}%`;

  // Fișe completate
  document.getElementById('worksheets-done').textContent = stats.worksheets_completed;
  document.getElementById('worksheets-total').textContent = stats.worksheets_total;

  // Top 3 clasament general (cu rank sportiv)
  populateOverallLeaderboard(stats.overall_top_3, dashboardData.student.id);
}

// Populează top 3 clasament general
function populateOverallLeaderboard(top3, currentStudentId) {
  const container = document.getElementById('overall-top3-container');
  container.innerHTML = '';

  if (!top3 || top3.length === 0) {
    container.innerHTML = '<p class="no-data">Nu există încă clasament</p>';
    return;
  }

  const leaderboardList = document.createElement('div');
  leaderboardList.className = 'leaderboard-list';

  top3.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';

    if (entry.student_id === currentStudentId) {
      item.classList.add('you');
    }

    const medal = getMedalForRank(entry.rank);

    item.innerHTML = `
      <div class="leaderboard-left">
        <span class="medal">${medal}</span>
        <span class="student-name">${
          entry.student_id === currentStudentId ? 'Tu' : entry.name
        }</span>
      </div>
      <span class="student-score">${entry.total_score} pct</span>
    `;

    leaderboardList.appendChild(item);
  });

  container.appendChild(leaderboardList);
}

// NOUĂ: Populează worksheets organizate pe MATERII
function populateWorksheetsBySubject() {
  const container = document.getElementById('subjects-container');
  const noWorksheetsDiv = document.getElementById('no-worksheets');

  container.innerHTML = '';

  const worksheets = dashboardData.worksheets;

  if (worksheets.length === 0) {
    noWorksheetsDiv.classList.remove('hidden');
    return;
  }

  noWorksheetsDiv.classList.add('hidden');

  // Grupează worksheets pe materii
  const worksheetsBySubject = {};

  worksheets.forEach((ws) => {
    if (!worksheetsBySubject[ws.subject]) {
      worksheetsBySubject[ws.subject] = [];
    }
    worksheetsBySubject[ws.subject].push(ws);
  });

  // Creează o secțiune pentru fiecare materie
  Object.entries(worksheetsBySubject).forEach(([subject, subjectWorksheets]) => {
    const section = createSubjectSection(subject, subjectWorksheets);
    container.appendChild(section);
  });

  console.log('Worksheets organizate pe materii:', Object.keys(worksheetsBySubject));
}

// Creează secțiune pentru o materie
function createSubjectSection(subject, worksheets) {
  const section = document.createElement('div');
  section.className = `subject-section ${subject}`;

  // Icon și nume materie
  const subjectInfo = getSubjectInfo(subject);

  // Calculează statistici pentru materie
  const completedCount = worksheets.filter((ws) => ws.has_attempted).length;
  const totalCount = worksheets.length;

  section.innerHTML = `
    <div class="subject-section-header">
      <span class="subject-icon">${subjectInfo.icon}</span>
      <h3 class="subject-section-title">${subjectInfo.name}</h3>
      <div class="subject-stats">
        <span class="subject-stat">
          📝 ${completedCount}/${totalCount} completate
        </span>
      </div>
    </div>
    <div class="worksheets-grid" id="grid-${subject}">
      <!-- Card-uri generate dinamic -->
    </div>
  `;

  // Populează grid-ul cu card-uri
  const grid = section.querySelector(`#grid-${subject}`);
  worksheets.forEach((worksheet) => {
    const card = createWorksheetCard(worksheet);
    grid.appendChild(card);
  });

  return section;
}

// Helper: obține info despre materie
function getSubjectInfo(subject) {
  const subjects = {
    religie: { name: 'Religie', icon: '✝️' },
    tic: { name: 'Tehnologia Informației și Comunicării', icon: '💻' },
    dirigentie: { name: 'Dirigenție', icon: '👥' },
  };

  return subjects[subject] || { name: subject.toUpperCase(), icon: '📚' };
}

// Creează card pentru worksheet
function createWorksheetCard(worksheet) {
  const card = document.createElement('div');
  card.className = 'worksheet-card';
  card.setAttribute('data-subject', worksheet.subject);

  if (!worksheet.has_attempted) {
    card.classList.add('not-attempted');
  }

  const statusBadge = getStatusBadge(worksheet);

  card.innerHTML = `
    <div class="card-header">
      <span class="subject-badge ${worksheet.subject}">${worksheet.subject.toUpperCase()}</span>
      ${statusBadge}
    </div>

    <div class="card-content">
      <h4>${worksheet.title}</h4>
      ${
        worksheet.has_attempted
          ? createAttemptedContent(worksheet)
          : createNotAttemptedContent(worksheet)
      }
    </div>
  `;

  return card;
}

// Creează conținut pentru worksheets încercate
function createAttemptedContent(worksheet) {
  const percentage = (worksheet.student_best_score / worksheet.max_score) * 100;
  const scoreClass = getScoreClass(percentage);
  const medal = getMedalForRank(worksheet.student_rank);

  // Creează mini podium TOP 3
  const podiumHTML = createMiniPodium(
    worksheet.top_3,
    dashboardData.student.id,
    worksheet.student_rank,
    worksheet.student_best_score
  );

  return `
    <!-- Scorul studentului -->
    <div class="student-score-section">
      <div class="score-display">
        <span class="score-value">${worksheet.student_best_score}/${worksheet.max_score}</span>
        <span class="score-percent">(${percentage.toFixed(0)}%)</span>
      </div>
      <div class="score-bar">
        <div class="score-fill ${scoreClass}" style="width: ${percentage}%"></div>
      </div>
    </div>

    <!-- Ranking -->
    <div class="ranking-section">
      <div class="your-rank">
        <span class="rank-icon">${medal}</span>
        <span>Ești pe locul: <strong>${worksheet.student_rank}</strong> din ${
    worksheet.total_students
  }</span>
      </div>

      ${podiumHTML}

      <button class="view-full-ranking" onclick="showFullRanking(${worksheet.id})">
        Vezi top 3 complet
      </button>
    </div>

    <!-- Acțiuni -->
    <div class="card-actions">
      <button onclick="goToWorksheet('${worksheet.subject}', '${worksheet.grade}', '${
    worksheet.topic
  }')"
              class="btn-primary">
        Vezi fișa
      </button>
    </div>
  `;
}

// Creează conținut pentru worksheets neîncercate
function createNotAttemptedContent(worksheet) {
  return `
    <div class="not-attempted-message">
      <p>📝 Nu ai început încă această fișă</p>
    </div>

    <div class="card-actions">
      <button onclick="goToWorksheet('${worksheet.subject}', '${worksheet.grade}', '${worksheet.topic}')"
              class="btn-primary">
        Începe exercițiul
      </button>
    </div>
  `;
}

// REFACTORIZAT: Creează mini podium cu TOP 3 (rank sportiv)
function createMiniPodium(top3, currentStudentId, currentStudentRank, currentStudentScore) {
  if (!top3 || top3.length === 0) {
    return '<p class="no-data">Nu există încă clasament</p>';
  }

  let podiumHTML = '<div class="mini-podium">';

  // Dacă studentul e în top 3 (rank <= 3), afișează top 3 normal
  if (currentStudentRank <= 3) {
    // Afișează toți cei din top 3 poziții (poate fi mai mult de 3 persoane!)
    top3.forEach((entry) => {
      const medal = getMedalForRank(entry.rank);
      const isYou = entry.student_id === currentStudentId;

      podiumHTML += `
        <div class="podium-item ${isYou ? 'you' : ''}">
          <span class="medal">${medal}</span>
          <span class="name">${isYou ? 'Tu' : getShortName(entry.name)}</span>
          <span class="score">${entry.score}</span>
        </div>
      `;
    });
  } else {
    // Dacă studentul NU e în top 3, arată primii 2 + studentul
    const top2 = top3.slice(0, 2);

    top2.forEach((entry) => {
      const medal = getMedalForRank(entry.rank);

      podiumHTML += `
        <div class="podium-item">
          <span class="medal">${medal}</span>
          <span class="name">${getShortName(entry.name)}</span>
          <span class="score">${entry.score} puncte</span>
        </div>
      `;
    });

    // Adaugă studentul curent
    podiumHTML += `
      <div class="podium-item you">
        <span class="medal">Locul ${currentStudentRank}</span>
        <span class="name">Tu</span>
        <span class="score">${currentStudentScore} puncte</span>
      </div>
    `;
  }

  podiumHTML += '</div>';
  return podiumHTML;
}

// Helper: obține badge-ul de status
function getStatusBadge(worksheet) {
  if (!worksheet.is_active) {
    return '<span class="status-badge inactive">Închis</span>';
  }

  if (worksheet.has_attempted) {
    return '<span class="status-badge completed">Completată</span>';
  }

  return '<span class="status-badge not-started">Neînceput</span>';
}

// Helper: obține clasa CSS pentru scor
function getScoreClass(percentage) {
  if (percentage >= 80) return 'excellent';
  if (percentage >= 60) return 'good';
  return 'needs-improvement';
}

// Helper: obține medalie pentru rank
function getMedalForRank(rank) {
  const medals = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
  };
  return medals[rank] || '🏅';
}

// Helper: obține nume scurt
function getShortName(fullName) {
  const parts = fullName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }
  return fullName;
}

// Navighează la worksheet
function goToWorksheet(subject, grade, topic) {
  localStorage.setItem('returnToDashboard', 'true');
  window.location.href = '/worksheet.html';
}

// Afișează modal cu top 3 complet
function showFullRanking(worksheetId) {
  const worksheet = dashboardData.worksheets.find((w) => w.id === worksheetId);

  if (!worksheet) return;

  const modal = document.getElementById('ranking-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-ranking-content');

  modalTitle.textContent = `🏆 ${worksheet.title} - Primii 3`;

  let rankingHTML = '<div class="leaderboard-list">';

  // Afișează toți din top 3 poziții (cu rank sportiv)
  worksheet.top_3.forEach((entry) => {
    const medal = getMedalForRank(entry.rank);
    const isYou = entry.student_id === dashboardData.student.id;
    const percentage = (entry.score / worksheet.max_score) * 100;

    rankingHTML += `
      <div class="leaderboard-item ${isYou ? 'you' : ''}">
        <div class="leaderboard-left">
          <span class="medal">${medal}</span>
          <span class="student-name">${isYou ? 'Tu' : entry.name}</span>
        </div>
        <div>
          <span class="student-score">${entry.score}/${worksheet.max_score}</span>
          <span style="color: var(--text-muted); font-size: 0.85rem; margin-left: 0.5rem;">
            (${percentage.toFixed(0)}%)
          </span>
        </div>
      </div>
    `;
  });

  rankingHTML += '</div>';

  modalContent.innerHTML = rankingHTML;
  modal.classList.remove('hidden');
}

// Închide modal
function closeRankingModal() {
  document.getElementById('ranking-modal').classList.add('hidden');
}

// Închide modal la click pe overlay
document.addEventListener('click', function (e) {
  const modal = document.getElementById('ranking-modal');
  if (e.target === modal) {
    closeRankingModal();
  }
});

// Logout
function logoutStudent() {
  if (confirm('Ești sigur că vrei să ieși?')) {
    localStorage.removeItem('studentCode');
    location.reload();
  }
}

// Helper pentru loading state
function setLoadingState(button, loadingDiv, errorDiv, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.textContent = 'Se verifică...';
    loadingDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  } else {
    button.disabled = false;
    button.textContent = 'Intră în platformă';
    loadingDiv.classList.add('hidden');
  }
}

// Helper pentru afișarea erorilor
function showError(message, errorDiv) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');

  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}
