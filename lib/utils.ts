import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Some bundlers/interop paths can treat this module as having a default export
// and then attempt to access `.cn` on that default. Attach the function to
// itself to be resilient without changing any UI behavior.
;(cn as any).cn = cn

export default cn
