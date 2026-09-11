import { useEffect, useState } from 'react'

export function UrlBar(): React.JSX.Element {
  const [url, setUrl] = useState('')

  useEffect(() => {
    window.bojeno.getActiveTabUrl().then((data) => setUrl(data.url))
    const unsubscribe = window.bojeno.onActiveTabUrlChanged((data) => setUrl(data.url))
    return unsubscribe
  }, [])

  return (
    <div className="url-bar">
      <span className="url-bar-text">{url}</span>
    </div>
  )
}
