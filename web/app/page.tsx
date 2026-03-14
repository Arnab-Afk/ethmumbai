import ProblemSection from "./components/ProblemSection";
import HowItWorks from "./components/HowItWorks";
import ENSConfigSection from "./components/ENSConfigSection";
import IntegrationsSection from "./components/IntegrationsSection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <div className="bg-[#F8F9FA] text-black min-h-screen overflow-x-hidden">
      <nav className="flex items-center justify-between px-4 md:px-8 py-6 relative z-50">
        <div className="flex items-center space-x-2">
          <svg
            className="text-black"
            fill="none"
            height="32"
            viewBox="0 0 32 32"
            width="32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 4L4 10V22L16 28L28 22V10L16 4Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
            <path d="M16 4V28" stroke="currentColor" strokeWidth="2.5" />
            <path d="M4 10L16 16L28 10" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          <span className="text-2xl tracking-tight" style={{ fontFamily: 'var(--font-bitcount)' }}>D3PLOY</span>
        </div>
        <div className="hidden md:flex items-center space-x-8 lg:space-x-10 text-xs lg:text-sm font-semibold uppercase tracking-wider">
          <a className="hover:text-[#0081BC] transition-colors" href="#why">
            Why
          </a>
          <a className="hover:text-[#0081BC] transition-colors" href="#how-it-works">
            How It Works
          </a>
          <a className="hover:text-[#0081BC] transition-colors" href="#deploy">
            Deploy
          </a>
          <a className="hover:text-[#0081BC] transition-colors" href="#integrations">
            Integrations
          </a>
        </div>
        <a
          className="bg-[#0081BC] text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-xs md:text-sm uppercase tracking-widest hover:brightness-110 transition-all"
          href="#"
        >
          Start Deploying
        </a>
      </nav>

      <main className="relative flex flex-col items-center justify-center pt-12 md:pt-24 pb-20 md:pb-32 px-4 max-w-[1400px] mx-auto min-h-[calc(100vh-120px)]">
        {/* Animated SVG decorative elements */}
        <svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="presentation"
          className="absolute top-[10%] left-[1%] w-[120px] md:w-[180px]"
          style={{ zIndex: 1 }}
          width="200"
        >
          <defs>
            <clipPath id="clip-overflow-200x200-green">
              <rect width="200" height="200" rx="2" fill="white" />
            </clipPath>
            <pattern
              id="bg-pattern-green"
              x="0"
              y="0"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              fill="var(--ens-green)"
            >
              <rect
                x="-1"
                y="1"
                width="1"
                height="1"
                transform="rotate(-45 0 0)"
                opacity="0.8"
              />
            </pattern>
          </defs>
          <g clipPath="url(#clip-overflow-200x200-green)">
            <rect width="200" height="200" fill="#F6F6F6" />
            <rect width="200" height="200" fill="url(#bg-pattern-green)" />
            <path d="M0 46H200" stroke="var(--ens-light-green)" strokeWidth="58" />
            <path d="M0 46H200" stroke="#F6F6F6" strokeWidth="2" />
            <rect x="200" y="29" width="33" height="33" rx="2" fill="#F6F6F6">
              <animateMotion
                begin="0.7s"
                dur="11.5s"
                repeatCount="indefinite"
                keyPoints="0;0.2;0.2;0.4;0.4;0.6;0.6;0.8;0.8;1;1;1"
                keyTimes="0;0.128;0.17;0.307;0.366;0.488;0.53;0.662;0.709;0.829;0.884;1"
                path="M-233,0 H0 M-233,0 H0 M-233,0 H0 M-233,0 H0 M-233,0 H0"
              />
            </rect>
          </g>
        </svg>

        <svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="presentation"
          className="absolute top-[5%] right-[20%] w-[120px] md:w-[180px]"
          style={{ zIndex: 1 }}
          width="200"
        >
          <defs>
            <clipPath id="clip-overflow-200x200-blue">
              <rect width="200" height="200" rx="2" fill="white" />
            </clipPath>
            <pattern
              id="bg-pattern-blue"
              x="0"
              y="0"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              fill="var(--ens-blue)"
            >
              <rect
                x="-1"
                y="1"
                width="1"
                height="1"
                transform="rotate(-45 0 0)"
                opacity="0.8"
              />
            </pattern>
          </defs>
          <g clipPath="url(#clip-overflow-200x200-blue)">
            <rect width="200" height="200" fill="#F6F6F6" />
            <rect width="200" height="200" fill="url(#bg-pattern-blue)" />
            <path
              d="M0 46H133C144.598 46 154 55.402 154 67V200"
              stroke="var(--ens-blue)"
              strokeWidth="58"
            />
            <path
              d="M0 46H133C144.598 46 154 55.402 154 67V200"
              stroke="#F6F6F6"
              strokeWidth="2"
            />
            <rect width="33" height="33" rx="2" fill="#F6F6F6" transform="translate(-16.5, -16.5)">
              <animateMotion
                begin="1.96s"
                dur="14.5s"
                repeatCount="indefinite"
                keyPoints="0;0.2;0.2;0.4;0.4;0.6;0.6;0.8;0.8;1;1;1"
                keyTimes="0;0.127;0.182;0.316;0.371;0.483;0.542;0.656;0.712;0.842;0.882;1"
                path="M154 217 V67 C154 55 145 46 133 46 H-17 M154 217 V67 C154 55 145 46 133 46 H-17 M154 217 V67 C154 55 145 46 133 46 H-17 M154 217 V67 C154 55 145 46 133 46 H-17 M154 217 V67 C154 55 145 46 133 46 H-17"
                rotate="auto"
              />
            </rect>
          </g>
        </svg>

        <svg
          viewBox="0 0 222 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="presentation"
          className="absolute bottom-[20%] left-[10%] w-[140px] md:w-[200px]"
          style={{ transform: "rotate(45deg)", zIndex: 1 }}
          width="222"
        >
          <defs>
            <clipPath id="clip-overflow-222x100">
              <rect width="222" height="100" rx="2" fill="white" />
            </clipPath>
            <pattern
              id="bg-pattern-magenta"
              x="0"
              y="0"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              fill="var(--ens-magenta)"
            >
              <rect
                x="-1"
                y="1"
                width="1"
                height="1"
                transform="rotate(-45 0 0)"
                opacity="0.8"
              />
            </pattern>
          </defs>
          <g clipPath="url(#clip-overflow-222x100)">
            <rect width="222" height="100" fill="#F6F6F6" />
            <rect width="222" height="100" fill="url(#bg-pattern-magenta)" />
            <path d="M0 46H222" stroke="var(--ens-light-magenta)" strokeWidth="58" />
            <path d="M0 46H222" stroke="#F6F6F6" strokeWidth="2" />
            <rect x="222" y="29" width="33" height="33" rx="2" fill="#F6F6F6">
              <animateMotion
                begin="1.78s"
                dur="13.3s"
                repeatCount="indefinite"
                keyPoints="0;0.2;0.2;0.4;0.4;0.6;0.6;0.8;0.8;1;1;1"
                keyTimes="0;0.134;0.188;0.308;0.356;0.485;0.534;0.67;0.726;0.854;0.901;1"
                path="M0,0 H-255 M0,0 H-255 M0,0 H-255 M0,0 H-255 M0,0 H-255"
              />
            </rect>
          </g>
        </svg>

        {/* Floating badges */}
        <div className="absolute top-8 md:top-16 left-4 md:left-16 z-20">
          <div className="bg-[#FDD6E8] text-[#E91E8C] px-5 md:px-7 py-2 md:py-3 rounded-2xl font-mono text-lg md:text-2xl font-bold">
            defi.eth
          </div>
        </div>

        <div className="absolute top-32 md:top-44 left-0 md:left-6 z-10">
          <div className="bg-[#FEFCE8] text-[#78350f] px-5 md:px-7 py-2 md:py-3 rounded-2xl font-mono text-lg md:text-2xl font-bold">
            staging.eth
          </div>
        </div>

        <div className="absolute top-16 md:top-24 right-[15%] md:right-[20%] z-10">
          <div className="bg-[#16A34A] text-white px-5 md:px-7 py-2 md:py-3 rounded-2xl font-mono text-lg md:text-2xl font-bold">
            dao.eth
          </div>
        </div>

        <div className="absolute bottom-20 md:bottom-32 left-4 md:left-20 z-10">
          <div className="bg-[#D1F4E0] text-[#166534] px-5 md:px-7 py-2 md:py-3 rounded-2xl font-mono text-lg md:text-2xl font-bold">
            bafybeig...
          </div>
        </div>

        {/* Decorative pink border element */}
        <div className="absolute bottom-16 md:bottom-28 left-8 md:left-24 w-32 md:w-48 h-24 md:h-36 border-l-[6px] md:border-l-8 border-b-[6px] md:border-b-8 border-[#EC4899] rounded-bl-[50px]"></div>

        {/* Pink bars decorative element */}
        <div className="absolute bottom-36 md:bottom-56 left-12 md:left-32 flex flex-col gap-2">
          <div className="w-8 md:w-12 h-16 md:h-24 bg-[#EC4899] rounded"></div>
          <div className="w-8 md:w-12 h-16 md:h-24 bg-[#EC4899] rounded"></div>
        </div>

        {/* Left side dot grid */}
        <div className="absolute bottom-8 md:bottom-12 left-28 md:left-48 w-20 md:w-32 h-20 md:h-32 dot-grid opacity-50"></div>

        {/* Top right decorative elements */}
        <div className="absolute top-12 md:top-20 right-8 md:right-16 w-32 md:w-56 h-16 md:h-24 border-t-2 border-[#E5E7EB] flex items-center opacity-60">
          <div className="w-4 md:w-6 h-4 md:h-6 bg-white border-2 border-[#E5E7EB] ml-auto"></div>
        </div>

        {/* Top right dot grid */}
        <div className="absolute top-20 md:top-32 right-12 md:right-28 w-24 md:w-40 h-24 md:h-40 dot-grid opacity-30"></div>

        {/* Blue rounded border element */}
        <div className="absolute top-24 md:top-36 right-16 md:right-32 w-20 md:w-32 h-20 md:h-32 border-r-[6px] md:border-r-8 border-t-[6px] md:border-t-8 border-[#0081BC] rounded-tr-[40px] md:rounded-tr-[60px]"></div>

        <div className="absolute top-[30%] md:top-[35%] right-4 md:right-12 z-10">
          <div className="bg-[#CFFAFE] text-[#0891B2] px-5 md:px-7 py-2 md:py-3 rounded-2xl font-mono text-lg md:text-2xl font-bold">
            myapp.eth
          </div>
        </div>

        <div className="absolute bottom-12 md:bottom-20 right-6 md:right-16 z-10">
          <div className="bg-[#EC4899] text-white px-5 md:px-8 py-3 md:py-4 rounded-2xl font-mono text-lg md:text-2xl font-bold shadow-lg">
            ipfs://
          </div>
        </div>

        {/* Pink diagonal element behind vitalik.eth */}
        <div className="absolute bottom-8 md:bottom-16 right-4 md:right-12 w-32 md:w-48 h-24 md:h-36 bg-[#FDD6E8] rounded-2xl transform rotate-[-8deg] -z-10"></div>

        {/* Main content */}
        <div className="relative z-20 text-center max-w-5xl mx-auto">
          <h1 className="text-5xl md:text-6xl lg:text-[68px] font-medium leading-[1.1] tracking-[-0.02em] mb-1">
            Welcome to the
          </h1>
          <div className="flex items-center justify-center gap-3 md:gap-4 mb-10 md:mb-12">
            <span className="text-[#D1D5DB] text-5xl md:text-7xl lg:text-[80px] font-light leading-none">
              [
            </span>
            <span className="text-5xl md:text-7xl lg:text-[80px] font-bold leading-none tracking-[-0.02em]">
              Unstoppable Web
            </span>
            <span className="text-[#D1D5DB] text-5xl md:text-7xl lg:text-[80px] font-light leading-none">
              ]
            </span>
          </div>
          <p className="font-serif text-[17px] md:text-[20px] lg:text-[22px] leading-[1.6] text-[#475569] max-w-3xl mx-auto px-4">
            A censorship-resistant deployment platform where sites live on IPFS,
            resolve through ENS, and cannot be governed by any single entity.
          </p>
          <div className="mt-12 flex items-center justify-center gap-4">
            <code className="bg-white px-6 py-4 rounded-xl font-mono text-[#0081BC] text-lg font-semibold shadow-sm border border-gray-100">
              npx web3deploy init
            </code>
          </div>
        </div>

        {/* Background dot grids */}
        <div className="absolute inset-0 -z-30 opacity-[0.03] pointer-events-none">
          <div className="absolute top-[20%] left-[15%] w-64 md:w-96 h-64 md:h-96 dot-grid"></div>
          <div className="absolute bottom-[15%] right-[10%] w-64 md:w-96 h-64 md:h-96 dot-grid"></div>
        </div>
      </main>

      {/* Additional Added Sections */}
      <ProblemSection />
      <HowItWorks />
      <ENSConfigSection />
      <IntegrationsSection />
      <Footer />
    </div>
  );
}

