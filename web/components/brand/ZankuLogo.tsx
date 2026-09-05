import Image from "next/image";

export function ZankuLogo({
  size = 144,
  priority = false,
}: {
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-zanku.jpg"
      alt="ZANKU Public Health"
      width={size}
      height={size}
      priority={priority}
      className="mx-auto rounded-[28px] object-cover shadow-sm"
    />
  );
}
