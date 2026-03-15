import Link from "next/link";
import Navbar from "@/components/navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-tg-black text-white font-sans antialiased p-6 md:p-12">
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Top Navigation */}
        <Navbar />

        {/* ── Hero Bento Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Hero Card */}
          <section className="md:col-span-8 rounded-card bg-tg-lavender p-8 md:p-12 flex flex-col justify-between h-100 text-tg-black transition-transform duration-200 hover:-translate-y-0.5">
            <div>
              <h1 className="font-display text-3xl md:text-5xl font-extrabold leading-tight tracking-tighter">
                Censorship-Resistant<br />Hosting
              </h1>
              <p className="mt-4 text-base font-medium opacity-80 max-w-md">
                Deploy decentralized applications directly to IPFS and ENS with
                millisecond latency. No servers. No censorship. Unstoppable.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <button className="bg-tg-black text-white px-8 py-4 rounded-full font-bold text-sm tracking-wide flex items-center space-x-2 hover:opacity-90 transition-all">
                  <span>GET STARTED</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </Link>
              <Link href="/dashboard">
                <button className="border border-tg-black/30 text-tg-black px-6 py-4 rounded-full font-bold text-sm tracking-wide hover:bg-tg-black/10 transition-all">
                  DASHBOARD
                </button>
              </Link>
            </div>
          </section>

          {/* Feature Card – IPFS */}
          <div className="md:col-span-4 rounded-card bg-tg-gray p-8 border border-white/5 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-2xl bg-tg-lavender/10 border border-tg-lavender/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-tg-lavender" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-xl font-bold mb-2">IPFS Hosting</h3>
              <p className="text-tg-muted text-sm leading-relaxed">
                Every deployment is content-addressed and pinned to IPFS. Your
                site lives forever — no single point of failure.
              </p>
            </div>
          </div>

          {/* Feature Card – ENS */}
          <div className="md:col-span-4 rounded-card bg-tg-gray p-8 border border-white/5 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-2xl bg-tg-lime/10 border border-tg-lime/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-tg-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-xl font-bold mb-2">ENS Resolution</h3>
              <p className="text-tg-muted text-sm leading-relaxed">
                Map your <span className="text-white font-mono">.eth</span> domain
                directly to your IPFS deployment. Human-readable, blockchain-secured.
              </p>
            </div>
          </div>

          {/* Feature Card – GitHub CI/CD */}
          <div className="md:col-span-4 rounded-card bg-tg-lime p-8 flex flex-col justify-between text-tg-black transition-transform duration-200 hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-2xl bg-tg-black/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-tg-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-xl font-bold mb-2">GitHub CI/CD</h3>
              <p className="text-tg-black/70 text-sm leading-relaxed">
                Connect your repo and every push to <span className="font-mono font-bold">main</span> auto-deploys
                to IPFS. Zero config continuous delivery.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <section className="md:col-span-12 rounded-card bg-tg-gray border border-white/5 p-8 md:p-12">
            <h2 className="font-display text-3xl font-bold mb-10">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Connect your repo",
                  desc: "Authenticate with GitHub and link your repository. D3PLOY registers a webhook to listen for new pushes.",
                },
                {
                  step: "02",
                  title: "Push to deploy",
                  desc: "On every push to your configured branch, D3PLOY builds your project and pins the output to IPFS automatically.",
                },
                {
                  step: "03",
                  title: "Resolve via ENS",
                  desc: "Your ENS domain is updated to point to the new IPFS CID. Anyone with a compatible browser can access your site.",
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="space-y-4">
                  <div className="font-display text-5xl font-extrabold text-white/10">
                    {step}
                  </div>
                  <h3 className="font-display text-lg font-bold">{title}</h3>
                  <p className="text-tg-muted text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Card */}
          <section className="md:col-span-12 rounded-card bg-tg-black border border-tg-lavender/20 p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl font-bold">
                Ready to go permissionless?
              </h2>
              <p className="text-tg-muted mt-2 text-sm">
                Connect your GitHub and ship your first decentralised site in
                under 2 minutes.
              </p>
            </div>
            <div className="flex items-center space-x-4 shrink-0">
              <Link href="/login">
                <button className="bg-tg-lavender text-tg-black px-8 py-4 rounded-full font-bold text-sm tracking-wide hover:opacity-90 transition-all font-display">
                  DEPLOY NOW →
                </button>
              </Link>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-tg-muted text-xs font-medium">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <span>© 2024 D3PLOY FOUNDATION</span>
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            <span className="hover:text-white cursor-pointer transition-colors">TERMS OF SERVICE</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-white transition-colors">TWITTER</a>
            <a href="#" className="hover:text-white transition-colors">GITHUB</a>
            <a href="#" className="hover:text-white transition-colors text-tg-lime">SYSTEM STATUS: OPTIMAL</a>
          </div>
        </footer>
      </main>
    </div>
  );
}