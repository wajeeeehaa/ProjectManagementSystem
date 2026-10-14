const MULTIPLIERS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export const parseDurationSeconds = (raw) => {
  const value = String(raw ?? '').trim();
  const match = /^(\d+)([smhd])?$/.exec(value);
  if (!match) {
    throw new Error(`Invalid duration "${value}"`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Invalid duration "${value}"`);
  }

  const seconds = amount * MULTIPLIERS[unit];
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(`Invalid duration "${value}"`);
  }

  return seconds;
};
