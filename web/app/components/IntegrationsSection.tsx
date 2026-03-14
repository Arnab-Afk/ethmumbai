const integrations = [
  { name: 'Pinata', type: 'IPFS Pinning', abbr: 'P', color: '#6C5CE7' },
  { name: 'web3.storage', type: 'Decentralized Storage', abbr: 'W', color: '#0081BC' },
  { name: 'Filebase', type: 'S3-Compatible Storage', abbr: 'F', color: '#E07B39' },
  { name: 'Gnosis Safe', type: 'Multi-sig Governance', abbr: 'G', color: '#12FF80' },
  { name: 'ENS', type: 'Naming Protocol', abbr: 'E', color: '#5298FF' },
  { name: 'GitHub Actions', type: 'CI/CD Automation', abbr: 'GH', color: '#24292e' },
];

export default function IntegrationsSection() {
  return (
    <section id="integrations" className="py-16 px-4 md:px-8 bg-white">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        <h2 className="font-extrabold leading-tight mb-4" style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: '#000' }}>
          Your gateway to<br />the decentralized web
        </h2>
        <p className="text-gray-600 text-lg mb-4 max-w-sm leading-relaxed">
          Envision a web where sites are unstoppable, identities are on-chain, and no company holds the keys.
        </p>

        <div className="border-t border-gray-200 my-10"></div>

        <div className="font-bold text-xs uppercase tracking-widest text-gray-900 mb-2">Key Integrations</div>
        <p className="text-gray-500 text-sm mb-10 max-w-sm">
          These protocols and services power D3PLOY, creating a fully decentralized deployment stack.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {integrations.map(({ name, type, abbr, color }) => (
            <div
              key={name}
              className="flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-4 border border-gray-100"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: color }}
              >
                {abbr}
              </div>
              <div>
                <div className="font-bold text-sm" style={{ color: '#000' }}>{name}</div>
                <div className="text-gray-400 text-xs">{type}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
