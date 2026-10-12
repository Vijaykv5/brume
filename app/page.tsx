import Link from "next/link";

export default function Home() {
  return (
    <main className="product-intro landing-page" aria-labelledby="landing-title">
      <div className="product-intro-content">
        <h1 id="landing-title">
          Enter BRUME World
          <span>where products come alive</span>
        </h1>
        <Link className="hero-action hero-action-primary" href="/flash-arena">
          <span>Explore BRUME World</span>
        </Link>
      </div>
    </main>
  );
}
