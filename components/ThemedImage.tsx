import { cn } from "@/lib/utils";
import Image, { ImageProps } from "next/image";

type Props = Omit<ImageProps, "src"> & { lightSrc: string; darkSrc: string };

// Both images are in the server HTML and CSS shows the one of the theme:
// next-themes puts the theme class on <html> before the first paint, so
// nothing waits for JavaScript. The hidden one is not downloaded as long as
// it is lazy (the default of next/image).
export const ThemedImage = ({
  lightSrc,
  darkSrc,
  className,
  alt,
  ...props
}: Props) => (
  <>
    <Image
      {...props}
      src={lightSrc}
      alt={alt}
      className={cn(className, "dark:hidden")}
    />
    <Image
      {...props}
      src={darkSrc}
      alt={alt}
      className={cn(className, "hidden dark:inline")}
    />
  </>
);
