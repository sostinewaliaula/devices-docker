export function sanitizePagination(pageInput, limitInput, options = {}) {
  const {
    defaultLimit = 50,
    maxLimit = 1000,
    offsetInput
  } = options;

  const parsedLimit = parseInt(limitInput, 10);
  const limit = Math.min(
    Math.max(Number.isNaN(parsedLimit) ? defaultLimit : parsedLimit, 1),
    maxLimit
  );

  const parsedPage = parseInt(pageInput, 10);
  const pageFromInput = Math.max(Number.isNaN(parsedPage) ? 1 : parsedPage, 1);

  let offset = (pageFromInput - 1) * limit;
  let page = pageFromInput;

  if (offsetInput !== undefined) {
    const parsedOffset = parseInt(offsetInput, 10);
    offset = Math.max(Number.isNaN(parsedOffset) ? 0 : parsedOffset, 0);
    page = Math.floor(offset / limit) + 1;
  }

  return {
    limit,
    offset,
    page
  };
}

