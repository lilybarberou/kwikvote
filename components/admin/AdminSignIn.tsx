"use client";

import { adminSignIn } from "@/lib/api/admin/mutation";
import { getErrorMessage, handleServerResponse } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export const AdminSignIn = ({ passwordInUrl }: { passwordInUrl: boolean }) => {
  const router = useRouter();

  // the password of an old bookmark leaves the address bar and the history
  useEffect(() => {
    if (passwordInUrl) window.history.replaceState(null, "", "/admin");
  }, [passwordInUrl]);

  const signIn = useMutation({
    mutationFn: async (password: string) =>
      handleServerResponse(await adminSignIn({ password })),
    // the page is rendered again on the server, with the session cookie
    onSuccess: () => router.refresh(),
  });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    if (typeof password === "string" && password) signIn.mutate(password);
  };

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Administration</h1>
      {passwordInUrl && (
        <p className="text-sm text-muted-foreground">
          Le mot de passe ne se met plus dans l'adresse de la page :
          saisissez-le ci-dessous.
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor="admin-password">Mot de passe administrateur</Label>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={signIn.isError}
          aria-describedby={signIn.isError ? "error-admin-password" : undefined}
        />
        {signIn.isError && (
          <p
            id="error-admin-password"
            role="alert"
            className="text-sm text-destructive dark:text-red-400"
          >
            {getErrorMessage(signIn.error)}
          </p>
        )}
        <Button type="submit" className="mt-3" disabled={signIn.isPending}>
          Se connecter
          {signIn.isPending && (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          )}
        </Button>
      </form>
    </div>
  );
};
