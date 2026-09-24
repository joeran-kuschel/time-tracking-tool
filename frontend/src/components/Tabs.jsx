import { useId, useRef, useState } from 'react'

// Tabs after the WAI-ARIA tabs pattern: one tab stop, arrow keys, Home and End move and select.
// tabs: [{ id, label, panel }]. Every panel stays mounted (hidden when inactive), so its state survives switching.
function Tabs({ label, tabs, className = '' }) {
  const [selectedId, setSelectedId] = useState(tabs[0].id)
  const baseId = useId()
  const tabRefs = useRef({})

  const select = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    setSelectedId(tab.id)
    tabRefs.current[tab.id]?.focus()
  }

  const handleKeyDown = (e) => {
    const index = tabs.findIndex((tab) => tab.id === selectedId)
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (target === undefined) return
    e.preventDefault()
    select(target)
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={handleKeyDown} className="flex gap-1 border-b border-line">
        {tabs.map((tab) => {
          const selected = tab.id === selectedId
          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[tab.id] = node }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(tab.id)}
              className={`-mb-px min-h-[2.75rem] border-b-[3px] px-3.5 text-[0.9375rem] ${
                selected ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== selectedId}
          className="pt-4"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  )
}

export default Tabs
