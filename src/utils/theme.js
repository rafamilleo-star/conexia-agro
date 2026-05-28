export const ADMIN_EMAIL = "rafaelmilleo@yahoo.com.br
export const ENABLE_ADMIN_TOOL = false

export const is Admin = (email) =>
  ENABLE_ADMIN_TOOLS && email && email.toLowerCase().trim() === ADMIN_EMAIL


