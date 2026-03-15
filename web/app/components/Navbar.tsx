'use client';

import { useState } from 'react';

const links = [
  { label: 'Why', href: '#why' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Deploy', href: '#deploy' },
  { label: 'Integrations', href: '#integrations' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-4 md:px-8 py-6 relative z-50">
      <div className="flex items-center">
        <span className="text-4xl tracking-tight" style={{ fontFamily: 'var(--font-bitcount)' }}>D3PLOY</span>
      </div>

      {/* Desktop links */}
      <div className="hidden md:flex items-center space-x-8 lg:space-x-10 text-xs lg:text-sm font-semibold uppercase tracking-wider">
        {links.map(({ label, href }) => (
          <a key={href} className="hover:text-[#0081BC] transition-colors" href={href}>
            {label}
          </a>
        ))}
      </div>

      {/* Desktop CTA */}
      <a
        className="hidden md:inline-block bg-[#0081BC] text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-xs md:text-sm uppercase tracking-widest hover:brightness-110 transition-all"
        href="https://app.d3ploy.xyz"
      >
        Start Deploying
      </a>

      {/* Mobile hamburger */}
      <button
        className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <span className={`block w-6 h-0.5 bg-black transition-transform duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-6 h-0.5 bg-black transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-6 h-0.5 bg-black transition-transform duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 bg-[#F8F9FA] border-t border-gray-200 flex flex-col px-6 py-6 gap-5 shadow-md md:hidden">
          {links.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="text-sm font-semibold uppercase tracking-wider hover:text-[#0081BC] transition-colors"
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
          <a
            href="https://app.d3ploy.xyz"
            className="mt-2 bg-[#0081BC] text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all text-center"
            onClick={() => setOpen(false)}
          >
            Start Deploying
          </a>
        </div>
      )}
    </nav>
  );
}
