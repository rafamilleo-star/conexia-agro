export const ADMIN_EMAIL = "rafaelmilleo@yahoo.com.br";
export const ENABLE_ADMIN_TOOLS = false;
export const isAdmin = (email) =>
  ENABLE_ADMIN_TOOLS && email && email.toLowerCase().trim() === ADMIN_EMAIL;

// Paleta de cores do CONÉXIA
export const C = {
  bg:   "#0D0D0D",
  card: "#141414",
  sf:   "#1A1A1A",
  brd:  "#2A2A2A",
  brdH: "#3A3A3A",
  txt:  "#F0EDE8",
  txM:  "#A09890",
  txL:  "#605850",
  gold: "#C9A84C",
  gB:   "#A8873A",
  gD:   "#1A1508",
  gL:   "#C9A84C40",
  w06:  "rgba(255,255,255,0.06)",
  grn:  "#4CAF7A",
  grnD: "#0A1F12",
  amb:  "#E8A020",
  cor:  "#E05050",
  corD: "#1F0A0A",
  blu:  "#5B9BD5",
  teal: "#4ABFBF",
  vio:  "#9B59B6",
};
