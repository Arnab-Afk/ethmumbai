export default function ENSConfigSection() {
  return (
    <section id="deploy" className="py-18 md:py-24 px-4 md:px-8 bg-white">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        <div className="grid gap-10 md:gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] md:items-end mb-12 md:mb-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500 mb-3">Deployment paths</p>
            <h2 className="text-4xl md:text-6xl font-bold leading-[0.98] tracking-[-0.04em]" style={{ color: '#000' }}>
              Deploy your own way
            </h2>
          </div>
          <p className="text-gray-600 text-base md:text-xl max-w-2xl leading-relaxed md:justify-self-end">
            Start from GitHub, automate through Actions, or manage custom ENS routing directly. The tooling changes, the ownership model does not.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">

          <div className="rounded-[30px] border border-[#B8DAEC] bg-[#F3FAFE] p-7 md:p-8 min-h-64 flex flex-col">
            <div className="w-12 h-1.5 rounded-full bg-primary mb-8"></div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-primary/70 mb-3">Connect</div>
            <h3 className="text-black font-bold text-2xl tracking-[-0.03em] mb-4">GitHub Connect</h3>
            <p className="text-slate-600 text-base leading-relaxed max-w-xs">
              Connect your repo and deploy on every push. Each project gets a stable random subdomain under pushx.eth.
            </p>
            <div className="mt-auto pt-10 text-sm font-medium text-primary">Best for zero-config starts</div>
          </div>

          <div className="rounded-[30px] border border-[#BED9BE] bg-[#F4FAF4] p-7 md:p-8 min-h-64 flex flex-col">
            <div className="w-12 h-1.5 rounded-full bg-[#2E6B2E] mb-8"></div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#2E6B2E]/70 mb-3">Automate</div>
            <h3 className="text-black font-bold text-2xl tracking-[-0.03em] mb-4">GitHub Actions</h3>
            <p className="text-slate-600 text-base leading-relaxed max-w-xs">
              Automate deploys on every push to main with Pinata-first uploads and backup pinning when needed.
            </p>
            <div className="mt-auto pt-10 text-sm font-medium text-[#2E6B2E]">Best for CI-driven teams</div>
          </div>

          <div className="rounded-[30px] border border-[#F2BCD9] bg-[#FFF5FA] p-7 md:p-8 min-h-64 flex flex-col">
            <div className="w-12 h-1.5 rounded-full bg-[#EC4899] mb-8"></div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#EC4899]/70 mb-3">Control</div>
            <h3 className="text-black font-bold text-2xl tracking-[-0.03em] mb-4">ENS Dashboard</h3>
            <p className="text-slate-600 text-base leading-relaxed max-w-xs">
              Use custom ENS with a one-time setup, then let every deploy move IPNS and IPFS records automatically.
            </p>
            <div className="mt-auto pt-10 text-sm font-medium text-[#EC4899]">Best for custom domains</div>
          </div>

        </div>

      </div>
    </section>
  );
}
