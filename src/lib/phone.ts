export function normalizeKrPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("82")) return `+${digits}`;
  if (/^0\d{8,10}$/.test(digits)) return `+82${digits.slice(1)}`;
  throw new Error("휴대전화 번호를 확인해 주세요.");
}
