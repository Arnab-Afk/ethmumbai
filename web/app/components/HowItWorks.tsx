export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-14 md:py-20 px-4 md:px-8" style={{ backgroundColor: '#F4F4F4' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Decorative bars — hidden on mobile */}
        <div className="relative h-28 mb-4 overflow-hidden hidden md:block">
          {/* Left green bars */}
          <div className="absolute left-0 top-3 space-y-1.5">
            <div className="h-9 w-72 rounded-sm" style={{ backgroundColor: '#2E6B2E' }}></div>
            <div
              className="h-9 w-80 rounded-sm"
              style={{
                backgroundColor: '#8EC88E',
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.25) 10px, rgba(255,255,255,0.25) 11px)',
              }}
            ></div>
          </div>
          {/* Center light-green bar */}
          <div className="absolute left-[22rem] top-9">
            <div
              className="h-9 w-52 rounded-sm"
              style={{
                backgroundColor: '#B8D8B8',
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.35) 8px, rgba(255,255,255,0.35) 9px)',
              }}
            ></div>
          </div>
          {/* Right blue bars */}
          <div className="absolute right-24 top-3 space-y-1.5">
            <div className="h-9 w-60 rounded-sm" style={{ backgroundColor: '#0081BC' }}></div>
            <div className="h-9 w-48 rounded-sm" style={{ backgroundColor: '#49A8CC' }}></div>
          </div>
          {/* Pink L-corner */}
          <div
            className="absolute right-0 top-3 w-24 h-24 border-r-8 border-t-8 rounded-tr-3xl"
            style={{ borderColor: '#EC4899' }}
          ></div>
          {/* Pink block */}
          <div className="absolute right-0 top-[5.5rem] w-10 h-20" style={{ backgroundColor: '#F9A8D4' }}></div>
        </div>

        <div className="mb-8 md:mb-12 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500 mb-3">How it works</p>
          <h2 className="text-3xl md:text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-black mb-4">
            The stack stays simple even when the infrastructure does not.
          </h2>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-xl">
            D3PLOY keeps deployment readable: redundant pinning, a censorship-resistant routing layer, and one place to manage updates.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          <div className="rounded-[28px] border border-black/8 bg-white px-6 md:px-8 py-6 md:py-8 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400 mb-8">Reliability</div>
            <div className="font-bold tracking-[-0.05em] text-[#EC4899] mb-2" style={{ fontSize: 'clamp(46px, 8vw, 88px)' }}>3</div>
            <div className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] leading-tight text-black">pinning providers</div>
          </div>

          <div className="rounded-[28px] border border-black/8 bg-white px-6 md:px-8 py-6 md:py-8 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400 mb-8">Availability</div>
            <div className="font-bold tracking-[-0.05em] text-[#EC4899] mb-2" style={{ fontSize: 'clamp(46px, 8vw, 88px)' }}>100%</div>
            <div className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] leading-tight text-black">censorship-resistant</div>
          </div>

          <div className="rounded-[28px] border border-black/8 bg-white px-6 md:px-8 py-6 md:py-8 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400 mb-8">Control</div>
            <div className="font-bold tracking-[-0.05em] text-[#EC4899] mb-2" style={{ fontSize: 'clamp(46px, 8vw, 88px)' }}>1</div>
            <div className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] leading-tight text-black">dashboard to manage</div>
          </div>
        </div>

      </div>
    </section>
  );
}
