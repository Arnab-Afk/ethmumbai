export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#0a0a0a' }} className="text-white pt-20 pb-10 px-4 md:px-8">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Top — wordmark + tagline */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 pb-16 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ fontFamily: 'var(--font-bitcount)' }} className="text-2xl tracking-tight">D3PLOY</span>
            </div>
            <p className="text-white/40 text-sm max-w-xs leading-relaxed">
              Web3 Vercel — decentralized hosting where your site lives on IPFS, resolves through ENS, and can&apos;t be governed by anyone.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://app.d3ploy.xyz"
              className="bg-[#EC4899] text-white px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all whitespace-nowrap"
            >
              Start Deploying
            </a>
          </div>
        </div>

        {/* Middle — link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 py-16 border-b border-white/10">
          <div>
            <div className="text-white/30 text-xs font-bold uppercase tracking-widest mb-5">Platform</div>
            <ul className="space-y-3">
              {['GitHub Actions', 'ENS Dashboard', 'Subname Registry'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-white/60 text-sm hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-white/30 text-xs font-bold uppercase tracking-widest mb-5">Developers</div>
            <ul className="space-y-3">
              {['Documentation', 'Config Schema', 'ENS Text Records'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-white/60 text-sm hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-white/30 text-xs font-bold uppercase tracking-widest mb-5">Ecosystem</div>
            <ul className="space-y-3">
              {['Pinata', 'Lighthouse (fallback)', 'Namespace Offchain', 'Gnosis Safe', 'ENS Protocol'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-white/60 text-sm hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-white/30 text-xs font-bold uppercase tracking-widest mb-5">Community</div>
            <ul className="space-y-3">
              {['GitHub', 'Discord', 'Twitter / X', 'Blog', 'Roadmap'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-white/60 text-sm hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-xs">
            © 2026 D3PLOY. 
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-white/25 text-xs hover:text-white/50 transition-colors">Privacy</a>
            <a href="#" className="text-white/25 text-xs hover:text-white/50 transition-colors">Terms</a>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-white/25 text-xs">All systems operational</span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
