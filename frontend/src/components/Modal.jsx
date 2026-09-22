import { useEffect, useId, useRef } from 'react'

// A modal dialog on the native <dialog>: the browser keeps focus inside it and makes the page behind it inert.
// It closes only through its own buttons (which call onClose) and Escape, not by clicking the backdrop.
// The content is only rendered while open, so every opening starts fresh. Opening focuses the first
// field; closing returns focus to the element that opened it. (Content must not focus itself: that would
// run before the opener is remembered.)
function Modal({ title, open, onClose, children }) {
  const dialog = useRef(null)
  const opener = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    const isOpen = element.hasAttribute('open')
    if (open && !isOpen) {
      opener.current = document.activeElement
      element.showModal()
      element.querySelector('input, select, textarea, button')?.focus()
    } else if (!open && isOpen) {
      element.close()
      opener.current?.focus()
      opener.current = null
    }
  }, [open])

  // Escape: let React state close the dialog, so it stays in sync
  const handleCancel = (e) => {
    e.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-6 text-ink shadow-xl backdrop:bg-black/50"
    >
      {open && (
        <>
          <h2 id={titleId} className="mb-4 font-serif text-2xl font-semibold">{title}</h2>
          {children}
        </>
      )}
    </dialog>
  )
}

export default Modal
