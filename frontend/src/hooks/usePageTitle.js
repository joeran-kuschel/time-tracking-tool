import { useEffect } from 'react'

// Sets the document title to "<title> · Time Tracking". Pass the translated text, so the title follows a language switch.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = `${title} · Time Tracking`
  }, [title])
}
