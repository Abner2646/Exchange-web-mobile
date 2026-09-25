const { isUuid } = require('./uuid');

describe('utils/uuid.isUuid', () => {
  test('accepts a canonical UUID (any case)', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
  });

  test('rejects non-UUID strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('123e4567e89b12d3a456426614174000')).toBe(false); // no dashes
    expect(isUuid('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // too short
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000-x')).toBe(false); // trailing
  });

  test('rejects null/undefined/empty without throwing', () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid('')).toBe(false);
  });

  test('coerces non-strings safely', () => {
    expect(isUuid(12345)).toBe(false);
    expect(isUuid({})).toBe(false);
  });
});
