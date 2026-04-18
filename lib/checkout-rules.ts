// ── Checkout-Regel-System ────────────────────────────────────────────────────
// Ersetzt die alten Boolean-Felder allowSingleOut / allowDoubleOut / allowTripleOut

export type CheckoutField = 'single' | 'double' | 'triple' | 'bull' | 'bullseye'

export interface CheckoutConfig {
  allowedFields: CheckoutField[]
  inRule?: CheckoutField[]   // Start-Regel (z.B. Double-In beim World Grand Prix)
}

// ── Benannte Presets ──────────────────────────────────────────────────────────

export const CHECKOUT_PRESETS: Record<string, CheckoutConfig> = {
  'straight-out': {
    allowedFields: ['single', 'double', 'triple', 'bull', 'bullseye'],
  },
  'single-out': {
    allowedFields: ['single', 'bull', 'bullseye'],
  },
  'double-out': {
    allowedFields: ['double', 'bullseye'],
  },
  'master-out': {
    allowedFields: ['double', 'triple', 'bullseye'],
  },
  'single-double-out': {
    allowedFields: ['single', 'double', 'bull', 'bullseye'],
  },
}

export const CHECKOUT_PRESET_LABELS: Record<string, string> = {
  'straight-out':      'Straight Out – Jedes Feld',
  'single-out':        'Single Out – Single + Bull/Bullseye',
  'double-out':        'Double Out – Nur Doppel/Bullseye (PDC)',
  'master-out':        'Master Out – Doppel oder Triple',
  'single-double-out': 'Single + Double Out – Kombinationsregel',
  'custom':            'Benutzerdefiniert',
}

export const CHECKOUT_PRESET_DESCRIPTIONS: Record<string, string> = {
  'straight-out':      'Jedes Feld schließt das Leg ab. Einfachste Regel, ideal für Einsteiger.',
  'single-out':        'Einfaches Feld, Single Bull (25) oder Bullseye (50) schließen ab. Anfängerfreundlich.',
  'double-out':        'Nur Doppelfelder (D1–D20) oder Bullseye (50) schließen ab. PDC-Standard.',
  'master-out':        'Doppel- oder Triplefelder schließen ab. Anspruchsvoller als Double Out.',
  'single-double-out': 'Single ODER Double + Bull/Single Bull. Kombinationsregel (z.B. Season 2).',
  'custom':            'Wähle selbst, welche Felder das Leg beenden dürfen.',
}

// Standard-Preset für neue Turniere
export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = CHECKOUT_PRESETS['double-out']

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/**
 * Erkennt ob eine Config einem benannten Preset entspricht.
 * Gibt den Preset-Key zurück, oder 'custom' wenn keine Übereinstimmung.
 */
export function getPresetId(config: CheckoutConfig): string {
  const fields = [...config.allowedFields].sort().join(',')
  for (const [key, preset] of Object.entries(CHECKOUT_PRESETS)) {
    if ([...preset.allowedFields].sort().join(',') === fields) {
      return key
    }
  }
  return 'custom'
}

/**
 * Prüft ob ein Dart-Treffer als gültiger Checkout gilt.
 *
 * Sonderregeln für Bull:
 * - baseValue 25, multiplier 'single' = Single Bull (25 Pts)
 *   → gültig wenn 'single' oder 'bull' in allowedFields
 * - baseValue 25, multiplier 'double' = Bullseye (50 Pts)
 *   → gültig wenn 'double' oder 'bullseye' in allowedFields
 */
export function isValidCheckout(
  multiplier: 'single' | 'double' | 'triple',
  baseValue: number,
  rest: number,
  config: CheckoutConfig,
): boolean {
  if (rest !== 0) return false

  const fields = config.allowedFields
  const isSingleBull = baseValue === 25 && multiplier === 'single'   // 25 pts
  const isBullseye   = baseValue === 25 && multiplier === 'double'   // 50 pts

  if (isSingleBull) {
    return fields.includes('single') || fields.includes('bull')
  }
  if (isBullseye) {
    return fields.includes('double') || fields.includes('bullseye')
  }

  // Normale Felder 1–20
  switch (multiplier) {
    case 'single': return fields.includes('single')
    case 'double': return fields.includes('double')
    case 'triple': return fields.includes('triple')
    default:       return false
  }
}

/**
 * Prüft ob ein Rest-Wert überhaupt noch checkoutbar ist.
 * Wird für Bust-Vorprüfung verwendet (rest === 1 ohne Single Out → immer Bust).
 */
export function canCheckout(rest: number, config: CheckoutConfig): boolean {
  if (rest <= 0) return false
  const fields = config.allowedFields

  // Rest 1: nur möglich wenn Single Out aktiv (Single 1 = 1 Punkt)
  if (rest === 1) {
    return fields.includes('single')
  }

  // Rest 2+: immer möglich wenn irgendein Feld erlaubt ist
  return fields.length > 0
}

/**
 * Fallback: konvertiert die alten Boolean-Felder in eine CheckoutConfig.
 * Wird für existierende Turnier-Dokumente ohne checkoutRule verwendet.
 */
export function fromLegacyBooleans(
  allowSingleOut: boolean,
  allowDoubleOut: boolean,
  allowTripleOut: boolean,
): CheckoutConfig {
  const fields: CheckoutField[] = []

  if (allowSingleOut) {
    fields.push('single', 'bull', 'bullseye')
  }
  if (allowDoubleOut) {
    if (!fields.includes('bullseye')) fields.push('bullseye')
    fields.push('double')
    if (!fields.includes('bull') && !allowSingleOut) fields.push('bull')
  }
  if (allowTripleOut) {
    if (!fields.includes('bullseye')) fields.push('bullseye')
    fields.push('triple')
  }

  // Standard-Fallback: Double Out
  if (fields.length === 0) {
    return CHECKOUT_PRESETS['double-out']
  }

  // Deduplizieren und in feste Reihenfolge bringen
  const ordered: CheckoutField[] = ['single', 'double', 'triple', 'bull', 'bullseye']
  return {
    allowedFields: ordered.filter(f => fields.includes(f)),
  }
}

/**
 * Gibt einen lesbaren String der aktiven Checkout-Felder zurück.
 * Beispiel: "Single + Double + Bull/Bullseye"
 */
export function describeCheckoutConfig(config: CheckoutConfig): string {
  const labels: Record<CheckoutField, string> = {
    single:   'Single',
    double:   'Double',
    triple:   'Triple',
    bull:     'Single Bull',
    bullseye: 'Bullseye',
  }
  return config.allowedFields.map(f => labels[f]).join(' + ')
}
