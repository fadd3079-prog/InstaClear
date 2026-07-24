import { parseLinkBasedHTML, parseTableBasedHTML } from './parser.js';
import { computeFinalTargets } from './calculator.js';
import {
  getActiveSessionCredentials,
  createNewSession,
  restoreSession,
  fetchSessionProgress,
  updateTargetStatusInSession,
  clearActiveSessionCredentials,
} from './supabase-client.js';

const APPLICATION_STATE = {
  IDLE: 'IDLE',
  VALIDATING: 'VALIDATING',
  PARSING_AND_COMPUTING: 'PARSING_AND_COMPUTING',
  READY: 'READY',
  MUTATING: 'MUTATING',
};

const FILE_IDENTIFIERS = {
  following: { pattern: /following/i, type: 'link', key: 'following' },
  followers: { pattern: /followers/i, type: 'link', key: 'followers' },
  pending: { pattern: /pending/i, type: 'table', key: 'pendingRequests' },
  recent: { pattern: /recent_follow/i, type: 'table', key: 'recentRequests' },
  unfollowed: {
    pattern: /recently_unfollowed/i,
    type: 'table',
    key: 'recentlyUnfollowed',
  },
  removed: {
    pattern: /removed_suggestions/i,
    type: 'table',
    key: 'removedSuggestions',
  },
};

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-fuchsia-500',
];

const GRID_ROW_LAYOUT_CLASS =
  'grid grid-cols-[45px_1fr_110px_90px] sm:grid-cols-[55px_1fr_130px_100px] md:grid-cols-[65px_1fr_140px_110px] gap-2 sm:gap-3 md:gap-4 items-center px-4 sm:px-6 py-3 border-b border-hairline';

let currentState = APPLICATION_STATE.IDLE;
let finalTargetList = [];
let completedUsernames = new Set();
const parsedDatasets = {};

function getAvatarColorClass(username) {
  let hashValue = 0;
  for (let charIndex = 0; charIndex < username.length; charIndex++) {
    hashValue =
      username.charCodeAt(charIndex) + ((hashValue << 5) - hashValue);
  }
  const colorIndex = Math.abs(hashValue) % AVATAR_COLORS.length;
  return AVATAR_COLORS[colorIndex];
}

function transitionState(newState) {
  currentState = newState;
  updateUIForState(newState);
}

function updateUIForState(state) {
  const dropzoneSection = document.getElementById('dropzone-section');
  const processingIndicator = document.getElementById('processing-indicator');
  const dataGridSection = document.getElementById('datagrid-section');
  const alertContainer = document.getElementById('alert-container');

  switch (state) {
    case APPLICATION_STATE.IDLE:
      dropzoneSection.classList.remove('hidden');
      processingIndicator.classList.add('hidden');
      dataGridSection.classList.add('hidden');
      alertContainer.classList.add('hidden');
      break;

    case APPLICATION_STATE.VALIDATING:
      alertContainer.classList.add('hidden');
      break;

    case APPLICATION_STATE.PARSING_AND_COMPUTING:
      dropzoneSection.classList.add('hidden');
      processingIndicator.classList.remove('hidden');
      dataGridSection.classList.add('hidden');
      break;

    case APPLICATION_STATE.READY:
      dropzoneSection.classList.add('hidden');
      processingIndicator.classList.add('hidden');
      dataGridSection.classList.remove('hidden');
      break;

    case APPLICATION_STATE.MUTATING:
      break;
  }
}

function showAlert(message, type) {
  const alertContainer = document.getElementById('alert-container');
  const alertMessage = document.getElementById('alert-message');
  const alertIcon = document.getElementById('alert-icon');

  alertMessage.textContent = message;

  alertContainer.className =
    'flex items-start gap-3 p-4 rounded-lg border mb-6';

  if (type === 'error') {
    alertContainer.className +=
      ' bg-red-50 border-red-200 text-red-800';
    alertIcon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else if (type === 'warning') {
    alertContainer.className +=
      ' bg-amber-50 border-amber-200 text-amber-800';
    alertIcon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else {
    alertContainer.className +=
      ' bg-blue-50 border-blue-200 text-blue-800';
    alertIcon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  alertContainer.classList.remove('hidden');
}

function updateHeaderActiveSessionBadge() {
  const activeBadge = document.getElementById('active-session-badge');
  if (!activeBadge) return;

  const activeSession = getActiveSessionCredentials();
  if (activeSession) {
    const displayName = activeSession.alias || activeSession.sessionId;
    activeBadge.textContent = `Sesi: ${displayName}`;
    activeBadge.classList.remove('hidden');
  } else {
    activeBadge.classList.add('hidden');
  }
}

function identifyFileType(fileName) {
  const identifiers = Object.values(FILE_IDENTIFIERS);

  for (const identifier of identifiers) {
    if (identifier.pattern.test(fileName)) {
      return identifier;
    }
  }

  return null;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.onerror = () => reject(fileReader.error);
    fileReader.readAsText(file, 'UTF-8');
  });
}

function checkMandatoryFiles() {
  return Boolean(parsedDatasets.following && parsedDatasets.followers);
}

function updateProcessButtonState() {
  const processButton = document.getElementById('process-button');
  if (!processButton) return;

  if (checkMandatoryFiles()) {
    processButton.disabled = false;
  } else {
    processButton.disabled = true;
  }
}

async function processFiles(fileList) {
  transitionState(APPLICATION_STATE.VALIDATING);

  for (const file of fileList) {
    if (file.type !== 'text/html' && !file.name.endsWith('.html')) {
      continue;
    }

    const fileIdentifier = identifyFileType(file.name);

    if (!fileIdentifier) {
      continue;
    }

    try {
      const rawHtmlString = await readFileAsText(file);
      let parsedSet;

      if (fileIdentifier.type === 'link') {
        parsedSet = parseLinkBasedHTML(rawHtmlString);
      } else {
        parsedSet = parseTableBasedHTML(rawHtmlString);
      }

      parsedDatasets[fileIdentifier.key] = parsedSet;
      updateFileSlotStatus(fileIdentifier.key, parsedSet.size);
    } catch (readError) {
      parsedDatasets[fileIdentifier.key] = new Set();
      updateFileSlotStatus(fileIdentifier.key, 0);
    }
  }

  updateProcessButtonState();
  transitionState(APPLICATION_STATE.IDLE);
}

async function executeComputationAndHydrate() {
  if (!checkMandatoryFiles()) {
    showAlert(
      'Berkas Mengikuti (following.html) dan Pengikut (followers_1.html) wajib diunggah sebelum memulai proses.',
      'warning'
    );
    return;
  }

  transitionState(APPLICATION_STATE.PARSING_AND_COMPUTING);

  finalTargetList = computeFinalTargets(parsedDatasets);

  if (finalTargetList.length === 0) {
    showAlert(
      'Struktur berkas tidak valid atau tidak memuat daftar nama pengguna.',
      'warning'
    );
    transitionState(APPLICATION_STATE.IDLE);
    return;
  }

  let activeSession = getActiveSessionCredentials();
  if (!activeSession) {
    activeSession = await createNewSession('', finalTargetList.length);
    updateHeaderActiveSessionBadge();
  }

  const unfollowedHistory = await fetchSessionProgress(activeSession.sessionId);
  completedUsernames = new Set(unfollowedHistory);

  renderDataGrid(finalTargetList);
  updateStatistics();
  transitionState(APPLICATION_STATE.READY);
}

function updateFileSlotStatus(fileKey, extractedCount) {
  const statusMapping = {
    following: 'slot-following-status',
    followers: 'slot-followers-status',
    pendingRequests: 'slot-pending-status',
    recentRequests: 'slot-recent-status',
    recentlyUnfollowed: 'slot-unfollowed-status',
    removedSuggestions: 'slot-removed-status',
  };

  const statusElementId = statusMapping[fileKey];

  if (!statusElementId) {
    return;
  }

  const statusElement = document.getElementById(statusElementId);

  if (!statusElement) {
    return;
  }

  statusElement.textContent = `${extractedCount} diekstrak`;
  statusElement.className =
    'text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full';
}

function renderDataGrid(targetUsernames) {
  const datagridBody = document.getElementById('datagrid-body');
  datagridBody.textContent = '';

  targetUsernames.forEach((username, index) => {
    const isCompleted = completedUsernames.has(username);
    const rowElement = document.createElement('div');

    rowElement.setAttribute('data-username', username);
    rowElement.className = isCompleted
      ? `${GRID_ROW_LAYOUT_CLASS} opacity-50 bg-canvas-soft-2`
      : `${GRID_ROW_LAYOUT_CLASS} hover:bg-canvas-soft transition-colors`;

    const indexCell = document.createElement('div');
    indexCell.className =
      'text-xs sm:text-sm text-mute font-mono tabular-nums text-left';
    indexCell.textContent = String(index + 1).padStart(3, '0');
    rowElement.appendChild(indexCell);

    const usernameCell = document.createElement('div');
    usernameCell.className =
      'flex items-center gap-2.5 sm:gap-3 text-left overflow-hidden min-w-0';

    const initialLetter = username.charAt(0).toUpperCase();
    const avatarColorClass = getAvatarColorClass(username);

    const avatarElement = document.createElement('div');
    avatarElement.className = `w-7 h-7 sm:w-8 sm:h-8 rounded-full ${avatarColorClass} text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`;
    avatarElement.textContent = initialLetter;

    const usernameText = document.createElement('span');
    usernameText.className = isCompleted
      ? 'text-xs sm:text-sm text-mute line-through font-medium truncate'
      : 'text-xs sm:text-sm text-ink font-medium truncate';
    usernameText.textContent = `@${username}`;

    usernameCell.appendChild(avatarElement);
    usernameCell.appendChild(usernameText);
    rowElement.appendChild(usernameCell);

    const statusCell = document.createElement('div');
    statusCell.className = 'text-left';

    const statusBadge = document.createElement('span');
    statusBadge.className = isCompleted
      ? 'inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-canvas-soft-2 text-mute border border-hairline'
      : 'inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
    statusBadge.textContent = isCompleted ? 'UNFOLLOWED' : 'WAITING';
    statusCell.appendChild(statusBadge);
    rowElement.appendChild(statusCell);

    const actionsCell = document.createElement('div');
    actionsCell.className =
      'flex items-center justify-end gap-1.5 sm:gap-2 text-right';

    const openLinkButton = document.createElement('button');
    openLinkButton.type = 'button';
    openLinkButton.className =
      'inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-md border border-hairline hover:bg-canvas-soft hover:border-hairline-strong transition-all text-body hover:text-ink shrink-0';
    openLinkButton.setAttribute('title', 'Buka Profil Instagram');
    openLinkButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    openLinkButton.addEventListener('click', () => {
      window.open(`https://www.instagram.com/${username}`, '_blank');
    });
    actionsCell.appendChild(openLinkButton);

    if (isCompleted) {
      const completedIndicator = document.createElement('span');
      completedIndicator.className =
        'inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-md text-gray-300 shrink-0';
      completedIndicator.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      actionsCell.appendChild(completedIndicator);
    } else {
      const markDoneButton = document.createElement('button');
      markDoneButton.type = 'button';
      markDoneButton.className =
        'inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-md border border-hairline hover:bg-emerald-50 hover:border-emerald-300 transition-all text-body hover:text-emerald-600 shrink-0';
      markDoneButton.setAttribute('title', 'Tandai Selesai');
      markDoneButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      markDoneButton.addEventListener('click', () => {
        handleMarkAsDone(username, rowElement, markDoneButton);
      });
      actionsCell.appendChild(markDoneButton);
    }

    rowElement.appendChild(actionsCell);
    datagridBody.appendChild(rowElement);
  });
}

async function handleMarkAsDone(username, rowElement, actionButton) {
  if (currentState === APPLICATION_STATE.MUTATING) {
    return;
  }

  transitionState(APPLICATION_STATE.MUTATING);

  completedUsernames.add(username);

  rowElement.className = `${GRID_ROW_LAYOUT_CLASS} opacity-50 bg-canvas-soft-2`;

  const usernameTextElement = rowElement.querySelector('span.truncate');
  if (usernameTextElement) {
    usernameTextElement.className =
      'text-xs sm:text-sm text-mute line-through font-medium truncate';
  }

  const statusBadge = rowElement.querySelector('span.rounded-full');
  if (statusBadge) {
    statusBadge.className =
      'inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-canvas-soft-2 text-mute border border-hairline';
    statusBadge.textContent = 'UNFOLLOWED';
  }

  const completedIndicator = document.createElement('span');
  completedIndicator.className =
    'inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-md text-gray-300 shrink-0';
  completedIndicator.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  actionButton.replaceWith(completedIndicator);

  updateStatistics();

  transitionState(APPLICATION_STATE.READY);

  const activeSession = getActiveSessionCredentials();
  if (activeSession) {
    updateTargetStatusInSession(activeSession.sessionId, username, 'UNFOLLOWED');
  }
}

function updateStatistics() {
  const totalTargetsElement = document.getElementById('stat-total-targets');
  const completedCountElement = document.getElementById('stat-completed');
  const remainingCountElement = document.getElementById('stat-remaining');
  const progressBarElement = document.getElementById('progress-bar');

  const totalCount = finalTargetList.length;
  const completedCount = completedUsernames.size;
  const remainingCount = totalCount - completedCount;
  const progressPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  totalTargetsElement.textContent = totalCount.toLocaleString();
  completedCountElement.textContent = completedCount.toLocaleString();
  remainingCountElement.textContent = remainingCount.toLocaleString();
  progressBarElement.style.width = `${progressPercentage}%`;

  const progressLabel = document.getElementById('progress-label');
  if (progressLabel) {
    progressLabel.textContent = `${progressPercentage}%`;
  }
}

function setupDropzone() {
  const dropzoneArea = document.getElementById('dropzone-area');
  const fileInput = document.getElementById('file-input');

  dropzoneArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzoneArea.classList.add('border-gray-900', 'bg-gray-50');
    dropzoneArea.classList.remove('border-gray-300');
  });

  dropzoneArea.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzoneArea.classList.remove('border-gray-900', 'bg-gray-50');
    dropzoneArea.classList.add('border-gray-300');
  });

  dropzoneArea.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzoneArea.classList.remove('border-gray-900', 'bg-gray-50');
    dropzoneArea.classList.add('border-gray-300');

    const droppedFiles = event.dataTransfer.files;

    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  });

  dropzoneArea.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (event) => {
    const selectedFiles = event.target.files;

    if (selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
  });
}

function setupProcessButton() {
  const processButton = document.getElementById('process-button');
  if (!processButton) return;

  processButton.addEventListener('click', () => {
    executeComputationAndHydrate();
  });
}

function setupFullscreenToggle() {
  const tableContainer = document.getElementById('table-container');
  const fullscreenButton = document.getElementById('fullscreen-button');
  const fullscreenIcon = document.getElementById('fullscreen-icon');
  const tableScrollArea = document.getElementById('table-scroll-area');

  if (!fullscreenButton || !tableContainer) return;

  fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      if (tableContainer.requestFullscreen) {
        tableContainer.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = Boolean(document.fullscreenElement);

    if (isFullscreen) {
      tableContainer.classList.add('p-4', 'sm:p-6', 'bg-white', 'h-full');
      tableScrollArea.classList.remove('max-h-[600px]');
      tableScrollArea.classList.add('h-[calc(100vh-100px)]');
      fullscreenButton.setAttribute('title', 'Keluar Layar Penuh');
      fullscreenIcon.innerHTML =
        '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
    } else {
      tableContainer.classList.remove('p-4', 'sm:p-6', 'bg-white', 'h-full');
      tableScrollArea.classList.add('max-h-[600px]');
      tableScrollArea.classList.remove('h-[calc(100vh-100px)]');
      fullscreenButton.setAttribute('title', 'Layar Penuh');
      fullscreenIcon.innerHTML =
        '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
    }
  });
}

function setupSessionModals() {
  const resetButton = document.getElementById('reset-button');
  const aliasModal = document.getElementById('alias-modal');
  const aliasInput = document.getElementById('alias-input');
  const cancelAliasButton = document.getElementById('cancel-alias-button');
  const confirmAliasButton = document.getElementById('confirm-alias-button');

  const credentialsModal = document.getElementById('credentials-modal');
  const copyCredentialsButton = document.getElementById('copy-credentials-button');
  const copyCredentialsText = document.getElementById('copy-credentials-text');
  const copyCredentialsIcon = document.getElementById('copy-credentials-icon');
  const downloadKeyButton = document.getElementById('download-key-button');
  const closeCredentialsModalButton = document.getElementById('close-credentials-modal-button');

  const restoreSessionButton = document.getElementById('restore-session-button');
  const restoreModal = document.getElementById('restore-modal');
  const restoreAlert = document.getElementById('restore-alert');
  const restoreSessionIdInput = document.getElementById('restore-session-id-input');
  const restoreSecurityKeyInput = document.getElementById('restore-security-key-input');
  const cancelRestoreButton = document.getElementById('cancel-restore-button');
  const confirmRestoreButton = document.getElementById('confirm-restore-button');

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (aliasInput) aliasInput.value = '';
      if (aliasModal) aliasModal.classList.remove('hidden');
    });
  }

  if (cancelAliasButton) {
    cancelAliasButton.addEventListener('click', () => {
      if (aliasModal) aliasModal.classList.add('hidden');
    });
  }

  if (confirmAliasButton) {
    confirmAliasButton.addEventListener('click', async () => {
      const aliasValue = aliasInput ? aliasInput.value.trim() : '';

      finalTargetList = [];
      completedUsernames = new Set();
      for (const key of Object.keys(parsedDatasets)) {
        delete parsedDatasets[key];
      }

      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';

      resetFileSlotStatuses();
      updateProcessButtonState();
      transitionState(APPLICATION_STATE.IDLE);

      const session = await createNewSession(aliasValue, 0);
      updateHeaderActiveSessionBadge();

      if (aliasModal) aliasModal.classList.add('hidden');

      const aliasElem = document.getElementById('modal-session-alias');
      const idElem = document.getElementById('modal-session-id');
      const keyElem = document.getElementById('modal-security-key');

      if (aliasElem) aliasElem.textContent = session.alias || session.sessionId;
      if (idElem) idElem.textContent = session.sessionId;
      if (keyElem) keyElem.textContent = session.securityKey;

      if (credentialsModal) credentialsModal.classList.remove('hidden');
    });
  }

  if (copyCredentialsButton) {
    copyCredentialsButton.addEventListener('click', () => {
      const activeSession = getActiveSessionCredentials();
      if (!activeSession) return;

      const formattedString = `Session ID: ${activeSession.sessionId} | Security Key: ${activeSession.securityKey}`;
      navigator.clipboard.writeText(formattedString).then(() => {
        if (copyCredentialsText) copyCredentialsText.textContent = 'Tersalin!';
        if (copyCredentialsIcon) {
          copyCredentialsIcon.innerHTML =
            '<polyline points="20 6 9 17 4 12"></polyline>';
        }
        setTimeout(() => {
          if (copyCredentialsText) copyCredentialsText.textContent = 'Salin Kunci Akses';
          if (copyCredentialsIcon) {
            copyCredentialsIcon.innerHTML =
              '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
          }
        }, 2000);
      });
    });
  }

  if (downloadKeyButton) {
    downloadKeyButton.addEventListener('click', () => {
      const activeSession = getActiveSessionCredentials();
      if (!activeSession) return;

      const aliasName = activeSession.alias || activeSession.sessionId;
      const fileContent = `================================================
INSTACLEAR SESSION SECURITY KEY
================================================
Alias Sesi   : ${aliasName}
Session ID   : ${activeSession.sessionId}
Kunci Akses  : ${activeSession.securityKey}
Waktu Dibuat : ${new Date().toLocaleString()}
================================================
Peringatan: Simpan file ini dengan aman. Kunci ini diperlukan
untuk memulihkan progres unfollow Anda jika berpindah perangkat.
`;

      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchorElement = document.createElement('a');
      const safeAlias = aliasName.replace(/[^a-z0-9]/gi, '_');

      anchorElement.href = downloadUrl;
      anchorElement.download = `InstaClear_Key_${safeAlias}.txt`;
      document.body.appendChild(anchorElement);
      anchorElement.click();
      document.body.removeChild(anchorElement);
      URL.revokeObjectURL(downloadUrl);
    });
  }

  if (closeCredentialsModalButton) {
    closeCredentialsModalButton.addEventListener('click', () => {
      if (credentialsModal) credentialsModal.classList.add('hidden');
    });
  }

  if (restoreSessionButton) {
    restoreSessionButton.addEventListener('click', () => {
      if (restoreSessionIdInput) restoreSessionIdInput.value = '';
      if (restoreSecurityKeyInput) restoreSecurityKeyInput.value = '';
      if (restoreAlert) restoreAlert.classList.add('hidden');
      if (restoreModal) restoreModal.classList.remove('hidden');
    });
  }

  if (cancelRestoreButton) {
    cancelRestoreButton.addEventListener('click', () => {
      if (restoreModal) restoreModal.classList.add('hidden');
    });
  }

  if (confirmRestoreButton) {
    confirmRestoreButton.addEventListener('click', async () => {
      const sessionIdValue = restoreSessionIdInput
        ? restoreSessionIdInput.value.trim()
        : '';
      const securityKeyValue = restoreSecurityKeyInput
        ? restoreSecurityKeyInput.value.trim()
        : '';

      if (!sessionIdValue || !securityKeyValue) {
        if (restoreAlert) {
          restoreAlert.textContent =
            'Mohon isi Session ID dan Kunci Akses terlebih dahulu.';
          restoreAlert.classList.remove('hidden');
        }
        return;
      }

      if (restoreAlert) restoreAlert.classList.add('hidden');

      const result = await restoreSession(sessionIdValue, securityKeyValue);

      if (!result.success) {
        if (restoreAlert) {
          restoreAlert.textContent = result.error;
          restoreAlert.classList.remove('hidden');
        }
        return;
      }

      updateHeaderActiveSessionBadge();
      completedUsernames = new Set(result.unfollowedUsernames);

      if (restoreModal) restoreModal.classList.add('hidden');

      if (finalTargetList.length > 0) {
        renderDataGrid(finalTargetList);
        updateStatistics();
      }

      showAlert(
        `Sesi "${result.alias || result.sessionId}" berhasil dipulihkan! (${result.unfollowedUsernames.length} target telah diselesaikan).`,
        'success'
      );
    });
  }
}

function resetFileSlotStatuses() {
  const slotIds = [
    'slot-following-status',
    'slot-followers-status',
    'slot-pending-status',
    'slot-recent-status',
    'slot-unfollowed-status',
    'slot-removed-status',
  ];

  for (const slotId of slotIds) {
    const element = document.getElementById(slotId);
    if (element) {
      element.textContent = 'Menunggu';
      element.className =
        'text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full';
    }
  }
}

function initializeApplication() {
  setupDropzone();
  setupProcessButton();
  setupFullscreenToggle();
  setupSessionModals();
  updateHeaderActiveSessionBadge();
  transitionState(APPLICATION_STATE.IDLE);
}

document.addEventListener('DOMContentLoaded', initializeApplication);
