import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showTagline = true,
  className = '',
}) => {
  const pinSize = size === 'sm' ? 24 : size === 'lg' ? 44 : 32;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Map Pin with Water Droplet inside */}
      <svg
        width={pinSize}
        height={pinSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        {/* Pin base (Navy #011638) */}
        <path
          d="M24 4C14.06 4 6 12.06 6 22C6 34 24 46 24 46C24 46 42 34 42 22C42 12.06 33.94 4 24 4Z"
          fill="#011638"
        />
        {/* Inner Droplet Shape (Teal #00628C & Light Blue #C8E6FF) */}
        <path
          d="M24 13C24 13 16 22 16 26.5C16 30.64 19.36 34 23.5 34C27.64 34 31 30.64 31 26.5C31 22 24 13 24 13Z"
          fill="#C8E6FF"
        />
        <path
          d="M24 16C24 16 18.5 23 18.5 26.5C18.5 29.5 20.96 32 24 32C27.04 32 29.5 29.5 29.5 26.5C29.5 23 24 16 24 16Z"
          fill="#00628C"
        />
      </svg>

      <div className="flex flex-col leading-tight">
        <span
          className={`font-bold tracking-tight text-navy ${
            size === 'sm'
              ? 'text-lg'
              : size === 'lg'
              ? 'text-2xl'
              : 'text-xl'
          }`}
        >
          Find<span className="text-[#00628C]">To</span>Fill
        </span>
        {showTagline && (
          <span className="text-[11px] font-medium text-slate-500 tracking-wide">
            Find it. Fill it.
          </span>
        )}
      </div>
    </div>
  );
};
