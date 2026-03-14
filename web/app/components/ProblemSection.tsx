export default function ProblemSection() {
  return (
    <div id="why" className="py-12 px-4 md:px-8 space-y-10" style={{ maxWidth: '1400px', margin: '0 auto' }}>

      {/* Slide 1: Blue — Deploy demo */}
      <div className="rounded-2xl overflow-hidden">
        <div style={{ backgroundColor: '#C4D9E8' }} className="px-8 md:px-14 py-10">
          <div className="flex gap-2 mb-6">
            <div className="w-4 h-4 bg-[#0081BC]"></div>
            <div className="w-4 h-4" style={{ backgroundColor: '#8ab4cc' }}></div>
            <div className="w-4 h-4" style={{ backgroundColor: '#8ab4cc' }}></div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row gap-8 md:gap-20" style={{ borderColor: '#8ab4cc' }}>
            <h2 className="text-2xl md:text-4xl font-bold w-full md:w-1/2 leading-tight" style={{ color: '#0d3d5c' }}>
              Farewell to downtime.
            </h2>
            <p className="text-base md:text-lg leading-relaxed w-full md:w-1/2" style={{ color: '#1e5f7a' }}>
              Your site lives on IPFS — content-addressed, unstoppable, and pinned to 3 providers simultaneously. No single entity can take it down.
            </p>
          </div>
        </div>
        <div
          className="px-8 md:px-16 py-16 flex justify-center"
          style={{
            backgroundColor: '#d8ecf8',
            backgroundImage: 'radial-gradient(#a0c4d8 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="bg-zinc-900 rounded-2xl p-6 shadow-2xl w-full max-w-xl text-left">
            <div className="flex gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="font-mono text-sm space-y-1.5">
              <div className="text-gray-500 text-xs mb-2"># GitHub Actions · deploy.yml · push to main</div>
              <div><span className="text-yellow-400">▶ </span><span className="text-white">Run deploy job</span></div>
              <div className="text-gray-400">Building... <span className="text-green-400">✓ dist/ (2.3MB, 847 files)</span></div>
              <div className="text-gray-400">Uploading to Pinata... <span className="text-green-400">✓ bafybeig3...</span></div>
              <div className="text-gray-400">Pinning to web3.storage... <span className="text-green-400">✓ bafybeig3...</span></div>
              <div className="text-gray-400">Pinning to Filebase... <span className="text-green-400">✓ bafybeig3...</span></div>
              <div className="text-gray-400">Updating ENS... <span className="text-green-400">✓ myapp.eth → bafybeig3... (tx: 0x3f2a...)</span></div>
              <div className="text-gray-400">Writing log... <span className="text-green-400">✓ latest-deploy.json</span></div>
              <div className="mt-3"><span className="text-white">🚀 Live at </span><span className="text-teal-400">https://myapp.eth.limo</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide 2: Pink — ENS config */}
      <div className="rounded-2xl overflow-hidden">
        <div style={{ backgroundColor: '#F0B8D4' }} className="px-8 md:px-14 py-10">
          <div className="flex gap-2 mb-6">
            <div className="w-4 h-4" style={{ backgroundColor: '#7c1052' }}></div>
            <div className="w-4 h-4" style={{ backgroundColor: '#c88aac' }}></div>
            <div className="w-4 h-4" style={{ backgroundColor: '#c88aac' }}></div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row gap-8 md:gap-20" style={{ borderColor: '#c888aa' }}>
            <h2 className="text-2xl md:text-4xl font-bold w-full md:w-1/2 leading-tight" style={{ color: '#5c0d34' }}>
              Config lives on-chain.
            </h2>
            <p className="text-base md:text-lg leading-relaxed w-full md:w-1/2" style={{ color: '#7a1e50' }}>
              Store your deploy config, framework, and access policy as ENS text records. Publicly auditable, immutable history — no dashboard to hack.
            </p>
          </div>
        </div>
        <div
          className="px-8 md:px-16 py-16 flex justify-center"
          style={{
            backgroundColor: '#fce0ef',
            backgroundImage: 'radial-gradient(#e8a8c8 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <span className="font-mono font-bold text-gray-800">myapp.eth</span>
              <span className="text-gray-400 text-sm">— ENS Text Records</span>
            </div>
            <div className="divide-y divide-gray-50">
              <div className="flex items-center px-6 py-3"><span className="font-mono text-sm text-gray-400 w-48">deploy.cid</span><span className="font-mono text-sm font-semibold text-teal-600">bafybeig3...</span></div>
              <div className="flex items-center px-6 py-3"><span className="font-mono text-sm text-gray-400 w-48">deploy.env</span><span className="font-mono text-sm font-semibold text-blue-600">production</span></div>
              <div className="flex items-center px-6 py-3"><span className="font-mono text-sm text-gray-400 w-48">deploy.framework</span><span className="font-mono text-sm font-semibold text-purple-600">next</span></div>
              <div className="flex items-center px-6 py-3"><span className="font-mono text-sm text-gray-400 w-48">access.policy</span><span className="font-mono text-sm font-semibold text-orange-600">token-gated</span></div>
              <div className="flex items-center px-6 py-3"><span className="font-mono text-sm text-gray-400 w-48">gov.multisig</span><span className="font-mono text-sm font-semibold text-red-600">0xSAFE...</span></div>
              <div className="flex items-center px-6 py-3"><span className="font-mono text-sm text-gray-400 w-48">fee.recipient</span><span className="font-mono text-sm font-semibold text-gray-600">0xABCD...</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide 3: Green — True ownership */}
      <div className="rounded-2xl overflow-hidden">
        <div style={{ backgroundColor: '#B4D4B4' }} className="px-8 md:px-14 py-10">
          <div className="flex gap-2 mb-6">
            <div className="w-4 h-4" style={{ backgroundColor: '#1a4d1a' }}></div>
            <div className="w-4 h-4" style={{ backgroundColor: '#7aaa7a' }}></div>
            <div className="w-4 h-4" style={{ backgroundColor: '#7aaa7a' }}></div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row gap-8 md:gap-20" style={{ borderColor: '#7aaa7a' }}>
            <h2 className="text-2xl md:text-4xl font-bold w-full md:w-1/2 leading-tight" style={{ color: '#0d2e0d' }}>
              True ownership.
            </h2>
            <p className="text-base md:text-lg leading-relaxed w-full md:w-1/2" style={{ color: '#2d5e2d' }}>
              Your ENS domain is 100% yours. No registrar can seize it, no CDN can blacklist you. Your site is uncensored and irrevocable — forever.
            </p>
          </div>
        </div>
        <div
          className="px-8 md:px-16 py-16"
          style={{
            backgroundColor: '#deeede',
            backgroundImage: 'radial-gradient(#90c490 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="text-red-500 font-bold text-xs uppercase tracking-widest mb-4">Web2 Hosting</div>
              <ul className="space-y-3 text-gray-600 text-sm">
                <li className="flex items-start gap-3"><span className="text-red-400 font-bold mt-0.5">✕</span>Domain registrars can seize your .com</li>
                <li className="flex items-start gap-3"><span className="text-red-400 font-bold mt-0.5">✕</span>CDNs can blacklist your IP address</li>
                <li className="flex items-start gap-3"><span className="text-red-400 font-bold mt-0.5">✕</span>GitHub can suspend your pipeline</li>
                <li className="flex items-start gap-3"><span className="text-red-400 font-bold mt-0.5">✕</span>No on-chain audit trail of deploys</li>
              </ul>
            </div>
            <div className="rounded-2xl p-6 text-white shadow-sm" style={{ backgroundColor: '#1a4d1a' }}>
              <div className="text-green-300 font-bold text-xs uppercase tracking-widest mb-4">D3PLOY</div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3"><span className="text-green-300 font-bold mt-0.5">✓</span>ENS domain — permanently on-chain</li>
                <li className="flex items-start gap-3"><span className="text-green-300 font-bold mt-0.5">✓</span>IPFS content is content-addressed forever</li>
                <li className="flex items-start gap-3"><span className="text-green-300 font-bold mt-0.5">✓</span>3-provider redundancy, always live</li>
                <li className="flex items-start gap-3"><span className="text-green-300 font-bold mt-0.5">✓</span>Immutable deploy registry on-chain</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
