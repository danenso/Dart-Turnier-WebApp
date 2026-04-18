'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'
import {
  CheckoutConfig,
  CheckoutField,
  CHECKOUT_PRESETS,
  CHECKOUT_PRESET_LABELS,
  CHECKOUT_PRESET_DESCRIPTIONS,
  describeCheckoutConfig,
  getPresetId,
} from '@/lib/checkout-rules'

interface CheckoutBuilderProps {
  value: CheckoutConfig
  onChange: (config: CheckoutConfig) => void
  showInRule?: boolean
}

const FIELD_LABELS: Record<CheckoutField, string> = {
  single:   'Single (1–20)',
  double:   'Double (D1–D20)',
  triple:   'Triple (T1–T20)',
  bull:     'Single Bull (25)',
  bullseye: 'Bullseye (50)',
}

const PRESET_ORDER = ['double-out', 'single-out', 'single-double-out', 'master-out', 'straight-out']

export function CheckoutBuilder({ value, onChange, showInRule = false }: CheckoutBuilderProps) {
  const [showInfo, setShowInfo] = useState<string | null>(null)
  const [showInRuleSection, setShowInRuleSection] = useState(false)

  const activePreset = getPresetId(value)

  const handlePresetSelect = (presetId: string) => {
    if (presetId === 'custom') return
    onChange(CHECKOUT_PRESETS[presetId])
  }

  const handleFieldToggle = (field: CheckoutField) => {
    const current = value.allowedFields
    const next = current.includes(field)
      ? current.filter(f => f !== field)
      : [...current, field]
    onChange({ ...value, allowedFields: next })
  }

  const handleInRuleToggle = (field: CheckoutField) => {
    const current = value.inRule ?? []
    const next = current.includes(field)
      ? current.filter(f => f !== field)
      : [...current, field]
    onChange({ ...value, inRule: next.length > 0 ? next : undefined })
  }

  return (
    <div className="space-y-3">
      {/* Preset-Liste */}
      <div className="space-y-1.5">
        {PRESET_ORDER.map(id => (
          <label
            key={id}
            className="flex items-start gap-2.5 cursor-pointer group"
          >
            <input
              type="radio"
              name="checkout-preset"
              value={id}
              checked={activePreset === id}
              onChange={() => handlePresetSelect(id)}
              className="mt-0.5 accent-amber-500 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium leading-tight">
                  {CHECKOUT_PRESET_LABELS[id]}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowInfo(showInfo === id ? null : id)
                  }}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              {showInfo === id && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                  {CHECKOUT_PRESET_DESCRIPTIONS[id]}
                </p>
              )}
            </div>
          </label>
        ))}

        {/* Custom Option */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="radio"
            name="checkout-preset"
            value="custom"
            checked={activePreset === 'custom'}
            onChange={() => {}}
            readOnly
            className="mt-0.5 accent-amber-500 shrink-0"
          />
          <span className="text-sm font-medium">
            {CHECKOUT_PRESET_LABELS['custom']}
          </span>
        </label>
      </div>

      {/* Custom-Modus: Checkboxen */}
      {activePreset === 'custom' && (
        <div className="ml-5 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1.5">
          {(['single', 'double', 'triple', 'bull', 'bullseye'] as CheckoutField[]).map(field => (
            <label key={field} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value.allowedFields.includes(field)}
                onChange={() => handleFieldToggle(field)}
                className="accent-amber-500"
              />
              <span className="text-sm">{FIELD_LABELS[field]}</span>
            </label>
          ))}
        </div>
      )}

      {/* Live-Anzeige */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-md px-3 py-1.5">
        → Aktive Regel:{' '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {value.allowedFields.length === 0
            ? 'Kein Feld ausgewählt'
            : describeCheckoutConfig(value)}
        </span>
      </p>

      {/* In-Regel (optional, collapsed) */}
      {showInRule && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowInRuleSection(v => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <span className="text-zinc-400">{showInRuleSection ? '▾' : '▸'}</span>
            Start-Regel (In-Rule) – nur für Spezialformate
          </button>
          {showInRuleSection && (
            <div className="mt-2 ml-3 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1.5">
              <p className="text-xs text-zinc-400 mb-1.5">
                Welches Feld muss das erste Leg starten? (z.B. Double-In beim World Grand Prix)
              </p>
              {(['single', 'double', 'triple', 'bull', 'bullseye'] as CheckoutField[]).map(field => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(value.inRule ?? []).includes(field)}
                    onChange={() => handleInRuleToggle(field)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm">{FIELD_LABELS[field]}</span>
                </label>
              ))}
              {(value.inRule?.length ?? 0) === 0 && (
                <p className="text-xs text-zinc-400">Deaktiviert – kein Start-Feld vorgeschrieben</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
