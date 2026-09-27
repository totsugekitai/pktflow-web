import type { PatternChoice } from '../../api/types.ts'
import { type FieldSpec, type PatternDraft, patternChoices } from './flowDraft.ts'
import styles from './FlowEditor.module.css'

export interface PatternFieldProps {
  spec: FieldSpec
  draft: PatternDraft
  onChange: (patch: Partial<PatternDraft>) => void
}

interface InputProps {
  spec: FieldSpec
  what: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}

function PatternInput({ spec, what, value, placeholder, onChange }: InputProps) {
  return (
    <input
      className={styles.input}
      aria-label={`${spec.label} ${what}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * Editor for one header field's OTG pattern: a choice selector followed by the
 * inputs that choice needs. A blank single value falls back to the daemon default.
 */
export function PatternField({ spec, draft, onChange }: PatternFieldProps) {
  const input = (what: string, key: keyof PatternDraft, placeholder: string) => (
    <PatternInput
      spec={spec}
      what={what}
      value={draft[key]}
      placeholder={placeholder}
      onChange={(value) => onChange({ [key]: value })}
    />
  )

  return (
    <div className={styles.patternRow}>
      <span className={styles.patternLabel}>{spec.label}</span>
      <select
        className={styles.input}
        aria-label={`${spec.label} pattern`}
        value={draft.choice}
        onChange={(e) => onChange({ choice: e.target.value as PatternChoice })}
      >
        {patternChoices(spec.kind).map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
      <div className={styles.patternInputs}>
        {draft.choice === 'value' && input('value', 'value', spec.placeholder)}
        {draft.choice === 'values' && input('values', 'values', `${spec.placeholder}, …`)}
        {(draft.choice === 'increment' || draft.choice === 'decrement') && (
          <>
            {input('start', 'start', spec.placeholder)}
            {input('step', 'step', spec.stepPlaceholder)}
            {input('count', 'count', 'count (1)')}
          </>
        )}
        {draft.choice === 'random' && (
          <>
            {input('min', 'min', 'min')}
            {input('max', 'max', 'max')}
            {input('count', 'count', 'count (1)')}
            {input('seed', 'seed', 'seed (0)')}
          </>
        )}
      </div>
    </div>
  )
}
