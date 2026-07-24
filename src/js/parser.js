function parseLinkBasedHTML(htmlString) {
  const extractedUsernames = new Set();

  try {
    const parsedDocument = new DOMParser().parseFromString(
      htmlString,
      'text/html'
    );

    const anchorElements = parsedDocument.querySelectorAll(
      'a[target="_blank"][href*="instagram.com"]'
    );

    for (const anchorElement of anchorElements) {
      const hrefValue = anchorElement.getAttribute('href');

      if (!hrefValue) {
        continue;
      }

      try {
        const parsedUrl = new URL(hrefValue);
        const pathSegments = parsedUrl.pathname
          .split('/')
          .filter((segment) => segment.length > 0);

        let resolvedUsername = null;

        const underscoreUIndex = pathSegments.indexOf('_u');
        if (underscoreUIndex >= 0 && underscoreUIndex < pathSegments.length - 1) {
          resolvedUsername = pathSegments[underscoreUIndex + 1];
        } else {
          const lastSegment = pathSegments[pathSegments.length - 1];
          if (lastSegment && lastSegment !== '_u') {
            resolvedUsername = lastSegment;
          }
        }

        if (resolvedUsername) {
          const sanitizedUsername = resolvedUsername
            .toLowerCase()
            .replace(/[^a-z0-9._]/g, '')
            .trim();

          if (sanitizedUsername.length > 0) {
            extractedUsernames.add(sanitizedUsername);
          }
        }
      } catch (urlParsingError) {
        continue;
      }
    }
  } catch (domParsingError) {
    return new Set();
  }

  return extractedUsernames;
}

function parseTableBasedHTML(htmlString) {
  const extractedUsernames = new Set();

  try {
    const parsedDocument = new DOMParser().parseFromString(
      htmlString,
      'text/html'
    );

    const tableRows = parsedDocument.querySelectorAll('tr');

    for (const tableRow of tableRows) {
      const tableCells = tableRow.querySelectorAll('td');

      for (let cellIndex = 0; cellIndex < tableCells.length; cellIndex++) {
        const cellText = tableCells[cellIndex].textContent.trim();

        const isUsernameLabel =
          cellText === 'Nama pengguna' || cellText === 'Username';

        if (isUsernameLabel && cellIndex + 1 < tableCells.length) {
          const usernameValue = tableCells[cellIndex + 1].textContent.trim();

          if (usernameValue.length > 0) {
            const sanitizedUsername = usernameValue
              .toLowerCase()
              .replace(/[^a-z0-9._]/g, '')
              .trim();

            if (sanitizedUsername.length > 0) {
              extractedUsernames.add(sanitizedUsername);
            }
          }
        }
      }
    }
  } catch (domParsingError) {
    return new Set();
  }

  return extractedUsernames;
}

function extractAccountUsername(htmlString) {
  if (!htmlString) {
    return null;
  }

  try {
    const parsedDocument = new DOMParser().parseFromString(
      htmlString,
      'text/html'
    );

    const titleText = parsedDocument.title || '';
    const titleMatch =
      titleText.match(/@([a-z0-9._]+)/i) ||
      titleText.match(/instagram\s*[-–]\s*([a-z0-9._]+)/i);

    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].toLowerCase().trim();
    }

    const headerElements = parsedDocument.querySelectorAll('h1, h2, ._a6-p, ._a6-q');
    for (const headerElement of headerElements) {
      const textContent = headerElement.textContent || '';
      const handleMatch = textContent.match(/@([a-z0-9._]+)/i);

      if (handleMatch && handleMatch[1]) {
        return handleMatch[1].toLowerCase().trim();
      }
    }

    const metaElement = parsedDocument.querySelector(
      'meta[name="owner"], meta[property="og:title"]'
    );

    if (metaElement) {
      const content = metaElement.getAttribute('content') || '';
      const metaMatch =
        content.match(/@([a-z0-9._]+)/i) || content.match(/([a-z0-9._]+)/i);

      if (metaMatch && metaMatch[1]) {
        return metaMatch[1].toLowerCase().trim();
      }
    }
  } catch (parsingError) {
    return null;
  }

  return null;
}

export { parseLinkBasedHTML, parseTableBasedHTML, extractAccountUsername };
