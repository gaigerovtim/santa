import type { SVGProps } from "react";

const common: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconFrame(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
      <circle cx="16.5" cy="9" r="1.5" />
    </svg>
  );
}

export function IconMail(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconCross(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

export const stepIcons = { camera: IconCamera, frame: IconFrame, mail: IconMail } as const;
