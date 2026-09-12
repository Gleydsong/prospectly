import Image from 'next/image';

export function V2Brand() {
  return (
    <span className="landing-v2-brand" aria-label="Prospectly">
      <Image
        src="/brand/prospectly-mark-v2.svg"
        width={34}
        height={34}
        alt=""
        aria-hidden
        priority
      />
      <span className="landing-v2-brand-word">rospectly</span>
    </span>
  );
}
