function normalizeUsername(rawString) {
  if (!rawString) return '';
  
  let decoded = rawString;
  try {
    decoded = decodeURIComponent(rawString);
  } catch (e) {
    // Ignore malformed URI
  }

  let cleaned = decoded.split('?')[0].split('#')[0];
  cleaned = cleaned.replace(/\/+$/, '').replace(/^@+/, '');
  cleaned = cleaned.toLowerCase().trim().replace(/[^a-z0-9._]/g, '');

  return cleaned;
}

function isValidUsername(sanitized) {
  const isNumericOnly = /^\d+$/.test(sanitized);
  const isDateLike = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(sanitized);
  const invalidSystemWords = [
    'instagram', 'profile', 'user', 'following', 'followers', 
    'next', 'previous', 'about', 'legal', 'help', 'accounts',
    'value', 'href', 'title', 'string_list_data', 'timestamp'
  ];
  
  return (
    sanitized.length > 0 && 
    sanitized.length <= 30 && 
    !isNumericOnly && 
    !isDateLike && 
    !invalidSystemWords.includes(sanitized)
  );
}

function parseMetaJSON(jsonString) {
  const extractedUsernames = new Set();
  
  if (!jsonString || typeof jsonString !== 'string') {
    return extractedUsernames;
  }

  try {
    const parsedData = JSON.parse(jsonString);

    function traverseAndExtract(obj) {
      if (Array.isArray(obj)) {
        obj.forEach(traverseAndExtract);
      } else if (obj !== null && typeof obj === 'object') {
        if (obj.string_list_data && Array.isArray(obj.string_list_data)) {
          obj.string_list_data.forEach(item => {
            let candidate = null;

            if (item && item.value && typeof item.value === 'string') {
              candidate = item.value;
            } else if (item && item.href && typeof item.href === 'string') {
              const match = item.href.match(/instagram\.com\/(?:_u\/)?([^"?#&'<>]+)/i);
              if (match && match[1]) {
                const segments = match[1].split('/').filter(Boolean);
                if (segments.length > 0) {
                  candidate = segments[0];
                }
              }
            }

            if (!candidate && obj.title && typeof obj.title === 'string') {
              candidate = obj.title;
            }

            if (candidate) {
              const sanitized = normalizeUsername(candidate);
              if (isValidUsername(sanitized)) {
                extractedUsernames.add(sanitized);
              }
            }
          });
        }
        
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            traverseAndExtract(obj[key]);
          }
        }
      }
    }

    traverseAndExtract(parsedData);
  } catch (error) {
    console.error('Failed to parse JSON file:', error);
  }

  return extractedUsernames;
}

export { parseMetaJSON };
