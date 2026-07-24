import { parseLinkBasedHTML, parseTableBasedHTML } from './parser.js';
import { computeFinalTargets } from './calculator.js';
import {
  getDeviceUUID,
  fetchUnfollowedHistory,
  markAsUnfollowed,
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

let currentState = APPLICATION_STATE.IDLE;
let deviceId = null;
let finalTargetList = [];
let completedUsernames = new Set();

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

async function processFiles(fileList) {
  transitionState(APPLICATION_STATE.VALIDATING);

  const validatedFiles = [];
  const identifiedKeys = new Set();

  for (const file of fileList) {
    if (file.type !== 'text/html' && !file.name.endsWith('.html')) {
      continue;
    }

    const fileIdentifier = identifyFileType(file.name);

    if (fileIdentifier && !identifiedKeys.has(fileIdentifier.key)) {
      validatedFiles.push({ file, identifier: fileIdentifier });
      identifiedKeys.add(fileIdentifier.key);
    }
  }

  if (!identifiedKeys.has('following')) {
    showAlert(
      'Berkas Mengikuti (Following) belum disertakan. Kalkulasi himpunan memerlukan data ini.',
      'error'
    );
    transitionState(APPLICATION_STATE.IDLE);
    return;
  }

  if (!identifiedKeys.has('followers')) {
    showAlert(
      'Berkas Pengikut (Followers) belum disertakan. Kalkulasi himpunan memerlukan data ini.',
      'error'
    );
    transitionState(APPLICATION_STATE.IDLE);
    return;
  }

  transitionState(APPLICATION_STATE.PARSING_AND_COMPUTING);

  const datasetObject = {};

  for (const { file, identifier } of validatedFiles) {
    try {
      const rawHtmlString = await readFileAsText(file);

      let parsedSet;

      if (identifier.type === 'link') {
        parsedSet = parseLinkBasedHTML(rawHtmlString);
      } else {
        parsedSet = parseTableBasedHTML(rawHtmlString);
      }

      datasetObject[identifier.key] = parsedSet;

      updateFileSlotStatus(identifier.key, parsedSet.size);
    } catch (readError) {
      datasetObject[identifier.key] = new Set();
      updateFileSlotStatus(identifier.key, 0);
    }
  }

  finalTargetList = computeFinalTargets(datasetObject);

  if (finalTargetList.length === 0) {
    showAlert(
      'Struktur berkas tidak valid atau tidak memuat daftar nama pengguna.',
      'warning'
    );
    transitionState(APPLICATION_STATE.IDLE);
    return;
  }

  deviceId = getDeviceUUID();

  const unfollowedHistory = await fetchUnfollowedHistory(deviceId);
  completedUsernames = new Set(
    unfollowedHistory.map((record) => record.target_username)
  );

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
  const tableBody = document.getElementById('datagrid-body');
  tableBody.textContent = '';

  targetUsernames.forEach((username, index) => {
    const isCompleted = completedUsernames.has(username);
    const tableRow = document.createElement('tr');

    tableRow.setAttribute('data-username', username);
    tableRow.className = isCompleted
      ? 'border-b border-gray-100 opacity-50 bg-gray-50'
      : 'border-b border-gray-100 hover:bg-gray-50 transition-colors';

    const indexCell = document.createElement('td');
    indexCell.className = 'px-4 py-3 text-sm text-gray-400 tabular-nums';
    indexCell.textContent = String(index + 1).padStart(3, '0');
    tableRow.appendChild(indexCell);

    const usernameCell = document.createElement('td');
    usernameCell.className = isCompleted
      ? 'px-4 py-3 text-sm text-gray-500 line-through'
      : 'px-4 py-3 text-sm text-gray-900 font-medium';
    usernameCell.textContent = username;
    tableRow.appendChild(usernameCell);

    const statusCell = document.createElement('td');
    statusCell.className = 'px-4 py-3';

    const statusBadge = document.createElement('span');
    statusBadge.className = isCompleted
      ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500'
      : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700';
    statusBadge.textContent = isCompleted ? 'UNFOLLOWED' : 'WAITING';
    statusCell.appendChild(statusBadge);
    tableRow.appendChild(statusCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'px-4 py-3';

    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'flex items-center gap-2';

    const openLinkButton = document.createElement('button');
    openLinkButton.className =
      'inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all text-gray-500 hover:text-gray-700';
    openLinkButton.setAttribute('title', 'Buka Profil Instagram');
    openLinkButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    openLinkButton.addEventListener('click', () => {
      window.open(`https://www.instagram.com/${username}`, '_blank');
    });
    actionsWrapper.appendChild(openLinkButton);

    if (isCompleted) {
      const completedIndicator = document.createElement('span');
      completedIndicator.className =
        'inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-300';
      completedIndicator.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      actionsWrapper.appendChild(completedIndicator);
    } else {
      const markDoneButton = document.createElement('button');
      markDoneButton.className =
        'inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-gray-500 hover:text-emerald-600';
      markDoneButton.setAttribute('title', 'Tandai Selesai');
      markDoneButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      markDoneButton.addEventListener('click', () => {
        handleMarkAsDone(username, tableRow, markDoneButton);
      });
      actionsWrapper.appendChild(markDoneButton);
    }

    actionsCell.appendChild(actionsWrapper);
    tableRow.appendChild(actionsCell);

    tableBody.appendChild(tableRow);
  });
}

async function handleMarkAsDone(username, tableRow, actionButton) {
  if (currentState === APPLICATION_STATE.MUTATING) {
    return;
  }

  transitionState(APPLICATION_STATE.MUTATING);

  completedUsernames.add(username);

  tableRow.className = 'border-b border-gray-100 opacity-50 bg-gray-50';

  const usernameCell = tableRow.querySelectorAll('td')[1];
  usernameCell.className = 'px-4 py-3 text-sm text-gray-500 line-through';

  const statusBadge = tableRow.querySelector('span');
  statusBadge.className =
    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500';
  statusBadge.textContent = 'UNFOLLOWED';

  const completedIndicator = document.createElement('span');
  completedIndicator.className =
    'inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-300';
  completedIndicator.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  actionButton.replaceWith(completedIndicator);

  updateStatistics();

  transitionState(APPLICATION_STATE.READY);

  markAsUnfollowed(deviceId, username);
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

function setupResetButton() {
  const resetButton = document.getElementById('reset-button');

  if (!resetButton) {
    return;
  }

  resetButton.addEventListener('click', () => {
    finalTargetList = [];
    completedUsernames = new Set();

    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.value = '';
    }

    resetFileSlotStatuses();
    transitionState(APPLICATION_STATE.IDLE);
  });
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
  setupResetButton();
  transitionState(APPLICATION_STATE.IDLE);
}

document.addEventListener('DOMContentLoaded', initializeApplication);
