import Image from "next/image";

interface LogoProps {
  size?: number;
  forceWhite?: boolean; // Landing page gibi HER ZAMAN koyu bir zemin üzerinde kullanılan yerler için
}

export default function Logo({ size = 36, forceWhite = false }: LogoProps) {
  if (forceWhite) {
    return (
      <div className="relative" style={{ width: size * 2.5, height: size * 1 }}>
        <Image
          src="/logo-sabancidx-white.png"
          alt="SabanciDx"
          fill
          sizes="100px"
          className="object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size * 2.5, height: size * 1 }}>
      <Image
        src="/logo-sabancidx.png"
        alt="SabanciDx"
        fill
        sizes="100px"
        className="object-contain dark:hidden"
        priority
      />
      <Image
        src="/logo-sabancidx-white.png"
        alt="SabanciDx"
        fill
        sizes="100px"
        className="object-contain hidden dark:block"
        priority
      />
    </div>
  );
}