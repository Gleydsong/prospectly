import Image from 'next/image';

type Props = {
  className?: string;
};

/** Accessible static globe for reduced-motion, no-WebGL, or pre-idle load. */
export function GlobeStaticFallback({ className }: Props) {
  return (
    <div
      className={`relative aspect-square w-full max-w-[560px] ${className ?? ''}`}
      aria-hidden
    >
      <Image
        src="/globe/earth-reference.png"
        alt=""
        fill
        sizes="(max-width: 1024px) 0px, 560px"
        className="object-contain opacity-90"
        priority={false}
      />
    </div>
  );
}
