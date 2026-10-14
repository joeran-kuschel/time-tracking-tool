// Shared Tailwind classes of the design, so buttons, fields and cards look the same everywhere
const button = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 min-h-[2.5rem] text-sm font-semibold'

export const ui = {
  buttonPrimary: `${button} bg-accent text-on-fill hover:bg-accent-dark`,
  buttonSecondary: `${button} border border-line-strong bg-surface text-ink hover:bg-paper`,
  buttonDanger: `${button} bg-danger text-on-fill hover:bg-danger-dark`,
  iconButton: 'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink/80 hover:bg-paper hover:text-ink',
  input: 'w-full min-h-[2.75rem] rounded-lg border border-line-strong bg-surface px-3 text-base text-ink aria-[invalid=true]:border-danger',
  // Native select without its own arrow: the chevron is a background image (--select-chevron in index.css) with room to the border;
  // in forced-colors mode (Windows High Contrast) the image would not follow the system colors, so the native arrow returns
  select: 'w-full min-h-[2.75rem] appearance-none rounded-lg border border-line-strong bg-surface bg-[image:var(--select-chevron)] bg-[position:right_1rem_center] bg-no-repeat bg-[size:1rem] pl-3 pr-11 text-base text-ink aria-[invalid=true]:border-danger forced-colors:appearance-auto forced-colors:bg-none forced-colors:pr-3',
  label: 'block text-sm font-medium mb-1',
  card: 'rounded-2xl border border-line bg-surface p-5 sm:p-6',
  eyebrow: 'text-xs font-semibold uppercase tracking-wider text-muted',
  figure: 'font-serif text-4xl font-medium leading-none',
}
