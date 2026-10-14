export const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  isVerified: user.isVerified,
  roleTitle: user.roleTitle,
});
