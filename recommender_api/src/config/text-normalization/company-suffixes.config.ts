/*
 * US company suffixes to strip during normalization.
 */
export const companySuffixes = [
  ", Inc.", " Inc.", " Inc",
  ", LLC", " LLC",
  ", Corp.", " Corp.", " Corp",
  " Corporation",
  ", L.P.", " L.P.", " LP",  // Limited Partnership
  ", L.L.C.", " L.L.C.",     // Alternate LLC format
];
