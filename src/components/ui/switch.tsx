/**
 * An on/off control that looks like one.
 *
 * The old version was a pill reading "Bật" or "Tắt", which has a specific
 * problem: the word names the *current* state, and half of everyone reads it as
 * the action the button will perform. So people turned things off by tapping a
 * control that said "Bật" and were surprised, every time.
 *
 * A track with a knob has no such ambiguity — right and lit is on, left and
 * grey is off, and nobody has to parse anything.
 */

import { cn } from '../../lib/utils'

export interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  /** One short clause, or nothing. Anything longer belongs on the About page. */
  hint?: string
}

export function Switch({ checked, onChange, label, hint }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full min-h-14 cursor-pointer items-center gap-3 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] leading-tight">{label}</span>
        {hint && <span className="block text-[0.8rem] leading-snug text-ink-dim">{hint}</span>}
      </span>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border'
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left]',
            checked ? 'left-6' : 'left-1'
          )}
        />
      </span>
    </button>
  )
}
