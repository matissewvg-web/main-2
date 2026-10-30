let woorden = {};

export function zetTaal(dict) {
  woorden = dict || {};
}

// t('rapport.netto', { waarde: '€ 5.000' }) → vervangt {waarde} in de tekst.
export function t(sleutel, vars) {
  let s = woorden[sleutel];
  if (s == null) return sleutel;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
