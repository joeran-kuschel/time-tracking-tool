import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import { ui } from '../ui'
import ErrorMessage from './ErrorMessage'

const MAX_BYTES = 1024 * 1024
const TYPES = ['image/png', 'image/jpeg']

const loadFailed = msg`The logo could not be loaded.`
const saveFailed = msg`The logo could not be saved.`
const removeFailed = msg`The logo could not be removed.`
const uploadHints = {
  400: msg`Choose a PNG or JPEG image of at most 1 MB and 2000 × 2000 pixels.`,
  413: msg`The file is too large. Choose an image of at most 1 MB.`,
}

// The image of a file as base64 (the backend takes the logo as JSON)
const readBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

// The logo of the Settings page (option type 'logo', see settingsGroups.js): a preview with a text alternative, a button to
// remove it and a file field to choose a new one. Unlike the other options, the logo is not part of the Save button: choosing
// a file stores it at once and Remove removes it at once, and a polite message says so. The checks of the type and size run
// in the browser first, so the error names the limit without a request; the backend checks again (utils/logoImage.js).
// The file field is disabled for the moment the logo is still loading, so a late answer can never replace a new choice.
// After removing, the focus moves to the file field, since the button is gone.
function LogoField({ option }) {
  const { t, i18n } = useLingui()
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const fileField = useRef(null)
  const busy = useRef(false)
  // The address of the image that is shown, so it is released when it is replaced and when the page is left
  const shown = useRef(null)
  // undefined while loading, null without a logo, else the address of the image shown
  const [preview, setPreview] = useState(undefined)
  const [status, setStatus] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [run, error, clear] = useAction()
  const shownError = fileError ?? error

  // The logo is loaded as a file and shown from the browser's memory, so a changed logo is never a cached one
  // Loads the stored logo and shows it (or none, when there is none). `current()` tells whether the page is still there.
  const loadPreview = useCallback((current = () => true) => run(async () => {
    try {
      const blob = await api.getLogo()
      if (current()) show(URL.createObjectURL(blob))
    } catch (err) {
      if (current()) show(null)
      if (err.status !== 404) throw err
    }
  }, loadFailed), [run])

  useEffect(() => {
    let current = true
    loadPreview(() => current)
    return () => {
      current = false
    }
  }, [loadPreview])

  useEffect(() => () => {
    if (shown.current) URL.revokeObjectURL(shown.current)
  }, [])

  // Shows a new image (or none) and lets go of the old one
  function show(url) {
    if (shown.current) URL.revokeObjectURL(shown.current)
    shown.current = url
    setPreview(url)
  }

  const choose = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again is a change
    if (!file || busy.current) return
    setStatus(null)
    clear()
    if (!TYPES.includes(file.type)) return setFileError(t`Choose a PNG or JPEG image. Other types, such as SVG, are not accepted.`)
    if (file.size > MAX_BYTES) return setFileError(t`The logo is larger than 1 MB. Choose a smaller file.`)
    setFileError(null)
    busy.current = true
    try {
      const saved = await run(async () => api.putLogo({ contentType: file.type, data: await readBase64(file) }), saveFailed, uploadHints)
      if (saved) {
        setStatus('saved')
        await loadPreview() // what is shown is what is stored, not the file that was chosen
      }
    } finally {
      busy.current = false
    }
  }

  const remove = async () => {
    if (busy.current) return
    busy.current = true
    setStatus(null)
    setFileError(null)
    try {
      const done = await run(async () => (await api.deleteLogo(), true), removeFailed)
      if (done) {
        show(null)
        setStatus('removed')
        fileField.current?.focus()
      }
    } finally {
      busy.current = false
    }
  }

  return (
    <div>
      <label htmlFor={id} className={ui.label}>{i18n._(option.label)}</label>
      {preview && (
        <div className="mb-3 flex flex-wrap items-center gap-4">
          {/* The PDF is white paper, so the preview is too */}
          <img src={preview} alt={t`Your logo`} className="max-h-20 max-w-[12rem] rounded border border-line bg-white p-1" />
          <button type="button" onClick={remove} className={ui.buttonSecondary}><Trans>Remove logo</Trans></button>
        </div>
      )}
      <input
        ref={fileField}
        id={id}
        type="file"
        disabled={preview === undefined}
        accept="image/png,image/jpeg"
        onChange={choose}
        aria-describedby={[option.hint && hintId, shownError && errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={shownError ? true : undefined}
        className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
      />
      {option.hint && <p id={hintId} className="mt-1 text-sm text-muted">{i18n._(option.hint)}</p>}
      <p role="status" className="mt-1 text-sm">
        {status === 'saved' && <Trans>Logo saved.</Trans>}
        {status === 'removed' && <Trans>Logo removed.</Trans>}
      </p>
      <ErrorMessage id={errorId} message={shownError} />
    </div>
  )
}

export default LogoField
