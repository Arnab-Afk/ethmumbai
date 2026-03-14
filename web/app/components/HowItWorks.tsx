export default function HowItWorks() {
  return (
    <section className="py-16 px-4 md:px-8" style={{ backgroundColor: '#F4F4F4' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Decorative bars */}
        <div className="relative h-28 mb-4 overflow-hidden">
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

        {/* Stat lines */}
        <div>
          <div className="flex items-baseline gap-4 md:gap-8 leading-none mb-2">
            <span className="font-bold tracking-tighter" style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: '#EC4899' }}>3</span>
            <span className="font-bold tracking-tighter" style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: '#000' }}>pinning providers</span>
          </div>
          <div className="flex items-baseline gap-4 md:gap-8 leading-none mb-2">
            <span className="font-bold tracking-tighter" style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: '#EC4899' }}>100%</span>
            <span className="font-bold tracking-tighter" style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: '#000' }}>censorship-resistant</span>
          </div>
          <div className="flex items-baseline gap-4 md:gap-8 leading-none">
            <span className="font-bold tracking-tighter" style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: '#EC4899' }}>1</span>
            <span className="font-bold tracking-tighter" style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: '#000' }}>command to deploy</span>
          </div>
        </div>

      </div>
    </section>
  );
}
