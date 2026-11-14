import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LockIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function UnlockIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.2-2.4" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M12 2c1 3-3 4.5-3 8a3 3 0 0 0 6 0c1 1.5 1 3 1 3.5A5.5 5.5 0 0 1 10.5 19 6.5 6.5 0 0 1 4 12.5C4 8 7 5 12 2Z" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5V4.5Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="7.5" r="2.3" />
      <path d="M15.5 14.2c2.6.5 4.5 2.8 4.5 5.8" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M12 2.5 19 5.5v5.3c0 4.7-3 8-7 10.2-4-2.2-7-5.5-7-10.2V5.5L12 2.5Z" />
    </svg>
  );
}
