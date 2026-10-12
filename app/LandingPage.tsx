import Link from "next/link";

function ArrowUpRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M5 15 15 5M7 5h8v8" />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 42 42">
      <path d="M11.4 24.7c-4.1 0-7.4-3-7.4-6.8 0-3.5 2.8-6.4 6.5-6.8C12 6.9 16.1 4 20.9 4c6 0 10.9 4.5 11.3 10.2 3.4.8 5.8 3.7 5.8 7 0 4-3.5 7.3-7.8 7.3H11.4Z" />
      <path d="M13.5 33.6h15M17.4 38h7.2" />
    </svg>
  );
}

function WorldPreview() {
  return (
    <div className="landing-world-frame" aria-hidden="true">
      <span className="landing-orbit landing-orbit-one" />
      <span className="landing-orbit landing-orbit-two" />

      <svg className="landing-world-art" viewBox="0 0 760 650" role="presentation">
        <defs>
          <linearGradient id="islandGrass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b9ed6b" />
            <stop offset="1" stopColor="#73bd48" />
          </linearGradient>
          <linearGradient id="islandSoil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b67d4f" />
            <stop offset="1" stopColor="#704633" />
          </linearGradient>
          <linearGradient id="buildingFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffdf5" />
            <stop offset="1" stopColor="#dfe7db" />
          </linearGradient>
          <filter id="worldShadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="28" stdDeviation="22" floodColor="#1a6a74" floodOpacity=".18" />
          </filter>
        </defs>

        <g className="landing-cloud landing-cloud-left">
          <ellipse cx="95" cy="164" rx="54" ry="19" fill="#fff" fillOpacity=".62" />
          <circle cx="75" cy="151" r="23" fill="#fff" fillOpacity=".62" />
          <circle cx="108" cy="143" r="31" fill="#fff" fillOpacity=".62" />
        </g>
        <g className="landing-cloud landing-cloud-right">
          <ellipse cx="663" cy="218" rx="48" ry="17" fill="#fff" fillOpacity=".52" />
          <circle cx="647" cy="205" r="21" fill="#fff" fillOpacity=".52" />
          <circle cx="677" cy="199" r="27" fill="#fff" fillOpacity=".52" />
        </g>

        <g filter="url(#worldShadow)">
          <path d="m111 338 263-150 281 149-7 105-267 157-265-148Z" fill="url(#islandSoil)" />
          <path d="m116 411 265 148 267-153v36L381 599 116 451Z" fill="#684334" opacity=".42" />
          <path d="m111 338 263-150 281 149-274 159Z" fill="url(#islandGrass)" />
          <path d="m251 325 126-72 139 74-131 76Z" fill="#d9d2bd" />
          <path d="m281 325 98-55 108 57-102 59Z" fill="#b9b4a5" />
          <path d="m108 337 274 159 273-159-1 24-273 158-270-157Z" fill="#5f9d3e" />
        </g>

        <g className="landing-building landing-building-main">
          <path d="m350 180 93 49-1 120-93 55-94-50 1-121Z" fill="url(#buildingFace)" />
          <path d="m350 180 93 49-94 54-93-50Z" fill="#f8f5e9" />
          <path d="m349 283 94-54-1 120-93 55Z" fill="#cad7c6" />
          <path d="m278 252 50 27v38l-50-27Zm0 55 50 27v38l-50-27Z" fill="#8ed8df" />
          <path d="m369 281 52-30v39l-52 30Zm0 55 52-30v39l-52 30Z" fill="#4fa8b4" />
          <path d="m329 393 20 11 21-12v-65l-41-22Z" fill="#246c46" />
          <path d="m246 229 103-60 104 55-10 14-94 54-103-54Z" fill="#0f7f3b" />
          <path d="m246 229 103 59 104-60-10 17-94 55-103-55Z" fill="#08612c" opacity=".58" />
        </g>

        <g className="landing-building landing-building-small">
          <path d="m507 289 65 34v74l-65 38-65-35v-75Z" fill="#f5ead5" />
          <path d="m507 289 65 34-65 38-65-36Z" fill="#fff7e8" />
          <path d="m507 361 65-38v74l-65 38Z" fill="#d9c7ae" />
          <path d="m520 356 36-21v26l-36 21Z" fill="#6cb8c5" />
          <path d="m463 321 44-26 44 23-44 26Z" fill="#0f7f3b" />
        </g>

        <g className="landing-billboard">
          <path d="m161 326 91 49v67l-91-49Z" fill="#f9fbf4" />
          <path d="m252 375 9-5v67l-9 5Z" fill="#aab8a6" />
          <path d="m161 326 9-5 91 49-9 5Z" fill="#d9e2d5" />
          <path d="m181 350 52 28" stroke="#0f7f3b" strokeWidth="8" strokeLinecap="round" />
          <path d="m181 370 36 19" stroke="#89c85f" strokeWidth="6" strokeLinecap="round" />
          <path d="m198 414v42m28-27v43" stroke="#674633" strokeWidth="7" strokeLinecap="round" />
        </g>

        <g className="landing-tree landing-tree-one">
          <path d="m532 221 2 83" stroke="#765039" strokeWidth="12" strokeLinecap="round" />
          <path d="m532 175 45 76-45 19-46-19Z" fill="#24794b" />
          <path d="m532 145 34 62-34 16-35-16Z" fill="#3f9e5d" />
        </g>
        <g className="landing-tree landing-tree-two">
          <path d="m619 331 1 65" stroke="#765039" strokeWidth="10" strokeLinecap="round" />
          <path d="m620 293 35 61-35 16-36-16Z" fill="#24794b" />
          <path d="m620 269 27 48-27 13-28-13Z" fill="#50a969" />
        </g>
        <g className="landing-tree landing-tree-three">
          <path d="m199 258 1 58" stroke="#765039" strokeWidth="9" strokeLinecap="round" />
          <path d="m200 221 33 58-33 15-34-15Z" fill="#277d4e" />
          <path d="m200 198 25 45-25 12-26-12Z" fill="#50a969" />
        </g>

        <g className="landing-avatar">
          <ellipse cx="427" cy="441" rx="24" ry="10" fill="#31584b" opacity=".18" />
          <path d="m420 411-9 31m23-31 9 31" stroke="#18372c" strokeWidth="8" strokeLinecap="round" />
          <path d="M409 372h37v44h-37Z" fill="#0f7f3b" />
          <circle cx="428" cy="355" r="20" fill="#d9aa7b" />
          <path d="M408 353c2-22 38-25 41 0-10-8-31-9-41 0Z" fill="#19382d" />
          <path d="m410 384-18 22m52-22 18 22" stroke="#d9aa7b" strokeWidth="8" strokeLinecap="round" />
        </g>

        <g className="landing-map-pin">
          <path d="M470 175c0 27-29 51-29 51s-29-24-29-51a29 29 0 1 1 58 0Z" fill="#0f7f3b" />
          <circle cx="441" cy="175" r="10" fill="#d8ff9c" />
        </g>
      </svg>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="brume-landing" aria-labelledby="landing-title">
      <div className="landing-sky" aria-hidden="true">
        <span className="landing-sun" />
        <span className="landing-haze landing-haze-one" />
        <span className="landing-haze landing-haze-two" />
        <span className="landing-grid" />
      </div>

      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="BRUME World home">
          <span className="landing-brand-mark">
            <BrandMark />
          </span>
          <span className="landing-brand-type">
            <strong>BRUME</strong>
            <small>WORLD</small>
          </span>
        </Link>

        <div className="landing-header-status" aria-label="World status: online">
          <span />
          Live
        </div>

        <Link className="landing-header-action" href="/flash-arena">
          Enter
          <ArrowUpRightIcon />
        </Link>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-kicker">A social world on Solana</p>
          <h1 id="landing-title">
            <span className="landing-heading-lead">Meet inside</span>
            <span className="landing-heading-world">BRUME.</span>
          </h1>

          <div className="landing-intro">
            <p>Walk. Talk. Build.</p>
          </div>

          <div className="landing-actions">
            <Link className="landing-primary-action" href="/flash-arena">
              <span>Enter arena</span>
              <ArrowUpRightIcon />
            </Link>
            <div className="landing-controls-note" aria-label="Use W A S D keys to move">
              <span className="landing-key">W</span>
              <span className="landing-key">A</span>
              <span className="landing-key">S</span>
              <span className="landing-key">D</span>
              <span>to move</span>
            </div>
          </div>
        </div>

        <div className="landing-visual">
          <WorldPreview />
        </div>
      </section>
    </main>
  );
}
