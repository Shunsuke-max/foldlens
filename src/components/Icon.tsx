import type { SVGProps } from 'react';

export type IconName =
  | 'folder' | 'upload' | 'more' | 'palette' | 'link' | 'surface' | 'reset'
  | 'eye' | 'eyeOff' | 'check' | 'info' | 'expand' | 'lock' | 'molecule'
  | 'file' | 'close' | 'chevron' | 'layers' | 'brightness';

const paths: Record<IconName, React.ReactNode> = {
  folder: <path d="M3 6.75h6l1.8 2.1H21v9.4a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 18.25V6.75Z" />,
  upload: <><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1.1a1.65 1.65 0 0 0 0-3.3h-.8a1.8 1.8 0 0 1 0-3.6H15A6 6 0 0 0 12 3Z" /><circle cx="7.4" cy="10.2" r=".8" fill="currentColor" stroke="none" /><circle cx="9.2" cy="6.9" r=".8" fill="currentColor" stroke="none" /><circle cx="13" cy="6.2" r=".8" fill="currentColor" stroke="none" /></>,
  link: <><path d="m9.8 14.2 4.4-4.4" /><path d="M7.3 16.7 5.9 18.1a3.5 3.5 0 0 1-5-5l3.2-3.2a3.5 3.5 0 0 1 5 0" transform="translate(3)" /><path d="m16.7 7.3 1.4-1.4a3.5 3.5 0 0 1 5 5l-3.2 3.2a3.5 3.5 0 0 1-5 0" transform="translate(-3)" /></>,
  surface: <circle cx="12" cy="12" r="8.5" strokeDasharray="3.2 3.2" />,
  reset: <><path d="M4.5 7.5V3.8m0 0h3.7M4.5 3.8A9 9 0 1 1 3 14" /><circle cx="12" cy="12" r="2.4" /></>,
  eye: <><path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.4" /></>,
  eyeOff: <><path d="m3 3 18 18" /><path d="M10.2 6.7A10.5 10.5 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a16 16 0 0 1-2.2 2.8M6.3 6.7C3.9 8.2 2.5 12 2.5 12s3.5 5.5 9.5 5.5c1 0 1.9-.15 2.75-.42" /></>,
  check: <path d="m4.5 12.5 4.6 4.6L19.8 6.4" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10.8v5.5" /><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none" /></>,
  expand: <><path d="M8.5 3.5h-5v5M15.5 3.5h5v5M8.5 20.5h-5v-5M15.5 20.5h5v-5" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" /></>,
  molecule: <><path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" /><path d="m8.2 8.3 3.8-2.1 3.8 2.1v4.4L12 14.8l-3.8-2.1V8.3Zm3.8 6.5v6.4" /></>,
  file: <><path d="M6 2.5h8l4 4V21H6V2.5Z" /><path d="M14 2.5v4h4M9 12h6m-6 3h6" /></>,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  brightness: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
};

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
}

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><Icon name="molecule" size={28} /></span>;
}
