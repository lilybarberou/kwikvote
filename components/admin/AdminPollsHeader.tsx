"use client";

import { adminSignOut } from "@/lib/api/admin/mutation";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useDebounceCallback } from "usehooks-ts";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export const AdminPollsHeader = () => {
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const router = useRouter();

  const signOut = async () => {
    await adminSignOut();
    router.refresh();
  };

  const handleChange = useDebounceCallback((val) => {
    if (!val) return setQuery(null);
    setQuery(val);
  }, 400);

  return (
    <div className="flex flex-wrap gap-4 border-b pb-4 dark:border-b-[#ffffff21]">
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Label htmlFor="admin-search">Rechercher un sondage</Label>
        <Input
          id="admin-search"
          placeholder="Titre ou description..."
          type="search"
          defaultValue={query}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
      <Button variant="outline" className="ml-auto self-end" onClick={signOut}>
        Se déconnecter
      </Button>
    </div>
  );
};
