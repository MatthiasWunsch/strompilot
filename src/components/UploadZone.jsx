import { useRef, useState, useCallback } from 'react'

export default function UploadZone({ onFile, busy }) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)

  const pick = useCallback((files) => {
    if (files && files[0]) onFile(files[0])
  }, [onFile])

  return (
    <section className="upload-wrap">
      <div
        className={'dropzone' + (drag ? ' is-drag' : '') + (busy ? ' is-busy' : '')}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files) }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click() }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          hidden
          onChange={(e) => pick(e.target.files)}
        />
        {busy ? (
          <div className="dz-busy">
            <div className="spinner" />
            <p>Datei wird gelesen…</p>
          </div>
        ) : (
          <>
            <div className="dz-icon" aria-hidden>
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M24 32V10" />
                <path d="M15 19l9-9 9 9" />
                <path d="M8 30v6a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-6" />
              </svg>
            </div>
            <h3>Verbrauchsdatei ablegen oder wählen</h3>
            <p className="dz-hint">
              E-Control Viertelstundenwerte als <code>.csv</code> oder <code>.xlsx</code>
            </p>
            <span className="dz-btn">Datei auswählen</span>
          </>
        )}
      </div>

      <div className="how">
        <h4>Woher bekomme ich die Datei?</h4>
        <p>
          Im Smart-Meter-Webportal deines Netzbetreibers (z.&nbsp;B. Wiener Netze, Netz NÖ,
          Energienetze Steiermark) findest du den Export deiner <strong>Viertelstundenwerte</strong>.
          Lade den Zeitraum, den du vergleichen möchtest, als CSV herunter und lege ihn hier ab.
        </p>
      </div>
    </section>
  )
}
