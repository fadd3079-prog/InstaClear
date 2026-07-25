function normalizeUsername(rawString) {
  if (!rawString) return '';
  return rawString.toLowerCase().trim().replace(/^@+/, '').replace(/[^a-z0-9._]/g, '');
}

function isValidUsername(sanitized) {
  if (!sanitized || sanitized.length === 0 || sanitized.length > 30) return false;
  if (/^\d+$/.test(sanitized)) return false;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(sanitized)) return false;

  const invalidSystemWords = [
    'instagram', 'profile', 'user', 'following', 'followers',
    'about', 'legal', 'help', 'accounts', 'explore', 'direct'
  ];

  return !invalidSystemWords.includes(sanitized);
}

function extractFromStringListData(items, parentTitle) {
  const usernames = [];

  for (const item of items) {
    if (item && item.value && typeof item.value === 'string') {
      usernames.push(item.value);
      continue;
    }

    if (parentTitle && typeof parentTitle === 'string' && parentTitle.length > 0) {
      usernames.push(parentTitle);
      continue;
    }

    if (item && item.href && typeof item.href === 'string') {
      const match = item.href.match(/instagram\.com\/(?:_u\/)?([^"?#&'<>/]+)/i);
      if (match && match[1]) {
        usernames.push(match[1]);
      }
    }
  }

  return usernames;
}

function extractFromLabelValues(labelValues) {
  for (const entry of labelValues) {
    if (
      entry &&
      entry.label &&
      (entry.label === 'Nama pengguna' || entry.label === 'Username') &&
      entry.value &&
      typeof entry.value === 'string'
    ) {
      return entry.value;
    }
  }
  return null;
}

function parseMetaJSON(jsonString) {
  const extractedUsernames = new Set();

  if (!jsonString || typeof jsonString !== 'string') {
    return extractedUsernames;
  }

  try {
    const parsedData = JSON.parse(jsonString);

    function processEntry(entry) {
      if (!entry || typeof entry !== 'object') return;

      if (entry.string_list_data && Array.isArray(entry.string_list_data)) {
        const candidates = extractFromStringListData(entry.string_list_data, entry.title);
        for (const candidate of candidates) {
          const sanitized = normalizeUsername(candidate);
          if (isValidUsername(sanitized)) {
            extractedUsernames.add(sanitized);
          }
        }
        return;
      }

      if (entry.label_values && Array.isArray(entry.label_values)) {
        const candidate = extractFromLabelValues(entry.label_values);
        if (candidate) {
          const sanitized = normalizeUsername(candidate);
          if (isValidUsername(sanitized)) {
            extractedUsernames.add(sanitized);
          }
        }
        return;
      }
    }

    if (Array.isArray(parsedData)) {
      parsedData.forEach(processEntry);
    } else if (typeof parsedData === 'object' && parsedData !== null) {
      if (parsedData.label_values) {
        processEntry(parsedData);
      } else {
        for (const key in parsedData) {
          if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
            const value = parsedData[key];
            if (Array.isArray(value)) {
              value.forEach(processEntry);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('parseMetaJSON: Failed to parse JSON file:', error.message);
  }

  return extractedUsernames;
}

export { parseMetaJSON };

