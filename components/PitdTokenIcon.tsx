export function PitdTokenIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="pitd-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" fill="url(#pitd-gradient)" />
      {/* Inner ring */}
      <circle cx="12" cy="12" r="7" fill="none" stroke="white" strokeWidth="0.8" opacity="0.3" />
      {/* Center mark: stylized "D" */}
      <path d="M10 8 L10 16 L14 16 C15.5 16 17 14.5 17 12 C17 9.5 15.5 8 14 8 Z" fill="white" opacity="0.9" />
    </svg>
  )
}
