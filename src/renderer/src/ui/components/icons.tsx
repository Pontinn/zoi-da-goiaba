// Iconografia inline (sem dependencia externa, sem download em runtime).
// Todos os icones herdam `currentColor` e o tamanho vem da prop `size`.
import type { SVGProps } from 'react'

export interface IconProps {
  size?: number
  className?: string
}

function base(size: number, className?: string): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: 'false',
    className
  }
}

export function GearIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function CopyIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function CheckIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  )
}

export function CrownIcon({ size = 14, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M3 7.5 7 11l5-6.5 5 6.5 4-3.5-1.8 10.5H4.8L3 7.5Z" />
      <path d="M4.8 19.5h14.4" />
    </svg>
  )
}

export function EyeIcon({ size = 14, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

export function MonitorIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </svg>
  )
}

export function WindowIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </svg>
  )
}

export function BroadcastIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 16.5a6.4 6.4 0 0 0 0-9" />
      <path d="M4.4 4.4a10.7 10.7 0 0 0 0 15.2M19.6 19.6a10.7 10.7 0 0 0 0-15.2" />
    </svg>
  )
}

export function StopIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CloseIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function ArrowLeftIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M20 12H4M10 6l-6 6 6 6" />
    </svg>
  )
}

export function PlusIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function KeyIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <circle cx="8" cy="14" r="4" />
      <path d="m11 11 8-8M17 5l2 2M14.5 7.5l2 2" />
    </svg>
  )
}

export function DiceIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function LogoutIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16.5 14.5 12 10 7.5M14 12H3.5" />
    </svg>
  )
}

export function BanIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function UserMinusIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 19.5a6 6 0 0 1 12 0M17 12.5h4" />
    </svg>
  )
}

export function DotsIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function VolumeIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.7a7.5 7.5 0 0 1 0 10.6" />
    </svg>
  )
}

export function VolumeMuteIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </svg>
  )
}

export function FullscreenIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}

export function FullscreenExitIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  )
}

export function PipIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <rect x="12" y="11" width="8" height="7" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SwapIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </svg>
  )
}

export function DownloadIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
    </svg>
  )
}

export function AlertIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}

export function GoIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}
