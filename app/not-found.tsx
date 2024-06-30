import { SignpostBig } from "lucide-react";
import Link from "next/link";

export default function PageNotFound() {
  return (
    <div className="mx-auto mt-24 flex flex-col items-center justify-center">
      <SignpostBig className="mb-10 h-24 w-24" />
      <p className="text-2xl font-bold">Vous êtes perdu.</p>
      <p className="text-center text-muted-foreground">
        Venez par{" "}
        <Link className="text-primary" href="/">
          ici
        </Link>
        .
      </p>
    </div>
  );
}
