type ProfileUser = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

function trimmed(value?: string | null) {
  return value?.trim() ?? '';
}

export function profileDisplayName(user?: ProfileUser | null) {
  if (!user) return 'User';
  const name = [trimmed(user.firstName), trimmed(user.lastName)].filter(Boolean).join(' ');
  if (name) return name;
  return trimmed(user.email) || 'User';
}

export function profileInitials(user?: ProfileUser | null) {
  const initials = `${trimmed(user?.firstName)[0] ?? ''}${trimmed(user?.lastName)[0] ?? ''}`.toUpperCase();
  if (initials) return initials;
  const emailLetter = trimmed(user?.email)[0];
  return emailLetter ? emailLetter.toUpperCase() : 'U';
}
