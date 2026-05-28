# ⚡ Strompilot

Lade deine **stündlichen / viertelstündlichen Stromverbrauchswerte** hoch und sieh,
welchen finanziellen Unterschied ein **dynamischer Spotmarkt-Tarif** gemacht hätte —
Stunde für Stunde gegen den echten österreichischen Day-Ahead-Spotpreis gerechnet.

Reines Frontend (Vite + React). Keine Datenbank, kein Backend, kein Login.
Deine Verbrauchsdatei wird **ausschließlich im Browser** verarbeitet und nirgendwo hochgeladen oder gespeichert.

## Wie es rechnet

1. Du lädst den CSV/XLSX-Export deiner Viertelstundenwerte hoch (E-Control-Format).
2. Die Werte werden auf Stunden aggregiert (das Zeitstempel-Label ist das *Ende* des Intervalls; die Zeitumstellung im Frühjahr/Herbst wird korrekt behandelt).
3. Für den abgedeckten Zeitraum werden die AT-Spotpreise von [energy-charts.info](https://www.energy-charts.info) (Fraunhofer ISE, Day-Ahead, **netto** in EUR/MWh) geladen.
4. Pro Stunde: `Verbrauch × (Spotpreis_netto × 1,20 USt + Aufschlag)`.
5. Aggregation auf Monatsebene und Gegenüberstellung zu deinem eingegebenen Fixpreis.

**Wichtig:** Verglichen wird nur der **Energiepreis** (inkl. USt). Netzentgelte, Abgaben
und Pauschalen sind auf **beiden** Seiten nicht enthalten — sie sind bei beiden Tarifmodellen
gleich und fallen aus dem Vergleich heraus. Der Aufschlag (z. B. ~1,5 ct/kWh wie bei aWattar)
gilt für alle Monate gleich.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) 18+ (empfohlen 20).

```bash
npm install
npm run dev
```

Dann die angezeigte lokale URL öffnen (meist http://localhost:5173).

Produktions-Build testen:

```bash
npm run build
npm run preview
```

## Auf GitHub pushen

```bash
git init
git add .
git commit -m "Strompilot: Spotmarkt-Vergleich für Österreich"
git branch -M main
git remote add origin https://github.com/<DEIN-NUTZER>/strompilot.git
git push -u origin main
```

## Auf Netlify deployen

**Variante A — über die Netlify-Website (einfachste):**

1. Bei [app.netlify.com](https://app.netlify.com) anmelden.
2. *Add new site → Import an existing project → GitHub* und das Repo `strompilot` wählen.
3. Netlify liest `netlify.toml` automatisch ein:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. *Deploy* klicken. Fertig — jeder Push auf `main` deployt automatisch neu.

**Variante B — über die CLI:**

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

## Datei-Format

Erwartet wird der **E-Control-Export** der Viertelstundenwerte, z. B.:

```
Ende Ablesezeitraum;Messintervall;Abrechnungsmaßeinheit;... [kWh];;
2025-05-01T00:15+02:00;QH;KWH;0,055;;
```

- Semikolon-getrennt, Komma als Dezimaltrennzeichen, optional BOM.
- Spalten werden anhand der Überschriften erkannt; fehlen sie, greift das Standardlayout
  (Spalte 1 = Zeitstempel, Spalte 4 = kWh).
- `.xlsx`/`.xls` werden ebenfalls gelesen (via SheetJS).

Andere Netzbetreiber-Formate können abweichen — bei Problemen die Spaltenerkennung in
`src/parseConsumption.js` (`findColumns`) anpassen.

## Tech

- [Vite](https://vitejs.dev) + [React](https://react.dev)
- [SheetJS](https://sheetjs.com) für XLSX/CSV-Parsing
- [Recharts](https://recharts.org) für die Diagramme
- Spotpreise: [energy-charts.info API](https://api.energy-charts.info) (Fraunhofer ISE, CORS-fähig, kein Token nötig)

## Haftung

Reines Schätz-/Vergleichswerkzeug, keine Gewähr für Richtigkeit. Tatsächliche Tarife,
Abrechnungsmodelle und Gebühren können abweichen.
