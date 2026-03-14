export default function ENSConfigSection() {
  return (
    <section id="deploy" className="py-16 px-4 md:px-8 bg-white">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        <h2 className="text-5xl md:text-7xl font-extrabold leading-tight mb-4" style={{ color: '#000' }}>
          Deploy your own way
        </h2>
        <p className="text-gray-500 text-lg mb-16 max-w-xs leading-relaxed">
          Wherever you start, you&apos;re building an unstoppable, censorship-resistant web.
        </p>

        {/* Cards in a rounded-top container */}
        <div className="rounded-t-[48px] border-2 border-gray-200 p-2 pb-0">
          <div className="grid md:grid-cols-3 gap-2">

            {/* Blue — GitHub Connect */}
            <div className="rounded-[36px] p-8 flex flex-col min-h-64 relative overflow-hidden" style={{ backgroundColor: '#0081BC' }}>
              <h3 className="text-white font-bold text-xl mb-3">GitHub Connect</h3>
              <p className="text-blue-100 text-base leading-relaxed">
                Connect your repo and deploy on every push. Each project gets a stable random subdomain under pushx.eth that updates automatically.
              </p>
              <div
                className="absolute bottom-6 right-6 w-16 h-16 border-2 border-blue-300 rounded-sm"
                style={{
                  opacity: 0.4,
                  backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
                  backgroundSize: '6px 6px',
                }}
              ></div>
            </div>

            {/* Green — GitHub Actions */}
            <div className="rounded-[36px] p-8 flex flex-col min-h-64 relative overflow-hidden" style={{ backgroundColor: '#2E6B2E' }}>
              <h3 className="text-white font-bold text-xl mb-3">GitHub Actions</h3>
              <p className="text-green-100 text-base leading-relaxed">
                Automate deploys on every push to main. We upload to Pinata first, then fail over to backup pinning if needed.
              </p>
              <div
                className="absolute bottom-6 right-6 w-16 h-16 border-2 border-green-300 rounded-sm"
                style={{
                  opacity: 0.4,
                  backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
                  backgroundSize: '6px 6px',
                }}
              ></div>
            </div>

            {/* Pink — ENS Dashboard */}
            <div className="rounded-[36px] p-8 flex flex-col min-h-64 relative overflow-hidden" style={{ backgroundColor: '#EC4899' }}>
              <h3 className="text-white font-bold text-xl mb-3">ENS Dashboard</h3>
              <p className="text-pink-100 text-base leading-relaxed">
                Use custom ENS with one-time wallet setup (ENS -&gt; IPNS), then every deploy updates IPNS -&gt; IPFS automatically.
              </p>
              <div
                className="absolute bottom-6 right-6 w-16 h-16 border-2 border-pink-300 rounded-sm"
                style={{
                  opacity: 0.4,
                  backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
                  backgroundSize: '6px 6px',
                }}
              ></div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
