import Image from 'next/image';
import Link from 'next/link';

export interface ClinicBridgeLogoProps {
  variant?: 'full' | 'mark' | 'horizontal';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
  href?: string;
  alt?: string;
  priority?: boolean;
}

const SIZE_MAP = {
  mark: {
    xs: { width: 24, height: 24, class: 'h-6 w-6' },
    sm: { width: 32, height: 32, class: 'h-8 w-8' },
    md: { width: 40, height: 40, class: 'h-10 w-10' },
    lg: { width: 48, height: 48, class: 'h-12 w-12' },
    xl: { width: 64, height: 64, class: 'h-16 w-16' },
    custom: { width: 40, height: 40, class: '' },
  },
  full: {
    xs: { width: 140, height: 40, class: 'h-7 w-auto' },
    sm: { width: 180, height: 50, class: 'h-9 w-auto' },
    md: { width: 220, height: 62, class: 'h-11 w-auto' },
    lg: { width: 280, height: 79, class: 'h-14 w-auto' },
    xl: { width: 360, height: 101, class: 'h-20 w-auto' },
    custom: { width: 220, height: 62, class: '' },
  },
  horizontal: {
    xs: { width: 140, height: 40, class: 'h-7 w-auto' },
    sm: { width: 180, height: 50, class: 'h-9 w-auto' },
    md: { width: 220, height: 62, class: 'h-11 w-auto' },
    lg: { width: 280, height: 79, class: 'h-14 w-auto' },
    xl: { width: 360, height: 101, class: 'h-20 w-auto' },
    custom: { width: 220, height: 62, class: '' },
  },
} as const;

export function ClinicBridgeLogo({
  variant = 'full',
  size = 'md',
  className = '',
  href,
  alt = 'ClinicBridge - AI-Powered Clinical Solutions',
  priority = false,
}: ClinicBridgeLogoProps) {
  const isMark = variant === 'mark';
  const src = isMark ? '/images/clinicbridge-mark.png' : '/images/clinicbridge-logo.png';
  const sizeConfig = isMark ? SIZE_MAP.mark[size] : SIZE_MAP.full[size];

  const content = (
    <Image
      src={src}
      alt={alt}
      width={sizeConfig.width}
      height={sizeConfig.height}
      priority={priority}
      className={`object-contain transition-transform duration-200 select-none ${sizeConfig.class} ${className}`}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg" aria-label={alt}>
        {content}
      </Link>
    );
  }

  return content;
}
