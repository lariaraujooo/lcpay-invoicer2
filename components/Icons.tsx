import type { SVGProps } from "react";

/**
 * Ícones em SVG (traço 1.5, família consistente) para o chrome da interface.
 * Os emojis do catálogo são conteúdo do produto, não ícones estruturais.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Marca da LC Culture Store: módulos de QR Code, remetendo ao logo do LC Pay. */
export function LcMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="8" className="fill-lc-amber-500" />
      <g className="fill-lc-purple-700">
        <path d="M7 7h7v3.2H10.2V14H7V7Z" />
        <path d="M18 7h7v7h-3.2v-3.8H18V7Z" />
        <path d="M7 18h3.2v3.8H14V25H7v-7Z" />
        <rect x="15.6" y="10.4" width="2.8" height="2.8" />
        <rect x="12.4" y="15.6" width="2.8" height="2.8" />
        <rect x="17.4" y="17.4" width="2.6" height="2.6" />
        <rect x="21.8" y="17.4" width="3.2" height="2.6" />
        <rect x="17.4" y="22" width="7.6" height="3" />
      </g>
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 3h2.2l2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.2L19.9 7H5.4" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Icon>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.6 2.6L16 9.4" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.6 2.6 20h18.8L12 3.6Z" />
      <path d="M12 9.5v4.2M12 17h.01" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

export function PixIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.6 3.9a2.4 2.4 0 0 1 3.4 0l2.6 2.6-1.8 1.8a2.4 2.4 0 0 1-3.4 0L6.8 5.7l1.8-1.8Z" />
      <path d="M15.4 20.1a2.4 2.4 0 0 1-3.4 0l-2.6-2.6 1.8-1.8a2.4 2.4 0 0 1 3.4 0l2.6 2.6-1.8 1.8Z" />
      <path d="M20.1 8.6a2.4 2.4 0 0 1 0 3.4l-2.6 2.6-1.8-1.8a2.4 2.4 0 0 1 0-3.4l2.6-2.6 1.8 1.8Z" />
      <path d="M3.9 15.4a2.4 2.4 0 0 1 0-3.4l2.6-2.6 1.8 1.8a2.4 2.4 0 0 1 0 3.4l-2.6 2.6-1.8-1.8Z" />
    </Icon>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.5} opacity={0.25} />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
