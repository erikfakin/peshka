// Formati prikaza koji se ponavljaju kroz aplikaciju.

export const fmtDatum = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
}) // 16. rujna 2026.

export const fmtDatumKratki = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
}) // 16. 9. 2026.

export const fmtSat = new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit' })

// Datum kao "2026-09-16" po lokalnom vremenu. toISOString() bi dao UTC, pa bi
// u Hrvatskoj između ponoći i 1-2 sata ujutro ispao jučerašnji dan.
export function isoDatum(d) {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function oblik(n, [jedan, dva, pet]) {
    if (n % 10 === 1 && n % 100 !== 11) return jedan
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return dva
    return pet
}
