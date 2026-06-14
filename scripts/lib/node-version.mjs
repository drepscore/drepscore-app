export const MIN_SUPPORTED_NODE_VERSION = [24, 15, 0];
export const MAX_EXCLUSIVE_NODE_VERSION = [25, 0, 0];

export function parseVersionParts(value) {
  const match = String(value).match(/^v?(\d+)\.(\d+)\.(\d+)/u);
  if (!match) {
    return [];
  }

  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

export function compareVersionParts(actual, expected) {
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    const actualPart = actual[index] || 0;
    const expectedPart = expected[index] || 0;
    if (actualPart > expectedPart) {
      return 1;
    }
    if (actualPart < expectedPart) {
      return -1;
    }
  }

  return 0;
}

export function formatVersionParts(parts) {
  return parts.join('.');
}

export function isNodeVersionSupported(value) {
  const actual = parseVersionParts(value);
  if (actual.length === 0) {
    return false;
  }

  return (
    compareVersionParts(actual, MIN_SUPPORTED_NODE_VERSION) >= 0 &&
    compareVersionParts(actual, MAX_EXCLUSIVE_NODE_VERSION) < 0
  );
}
