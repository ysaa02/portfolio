/** Two-digit card number: 1 → "01". */
export const pad = (n: number) => String(n).padStart(2, "0");
