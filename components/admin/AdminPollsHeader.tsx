"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useDebounceCallback } from "usehooks-ts";

import { Input } from "../ui/input";

export const AdminPollsHeader = () => {
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));

  const handleChange = useDebounceCallback((val) => {
    if (!val) return setQuery(null);
    setQuery(val);
  }, 400);

  return (
    <div className="flex flex-wrap gap-4 border-b pb-4 dark:border-b-[#ffffff21]">
      <Input
        placeholder="Rechercher..."
        defaultValue={query}
        onChange={(e) => handleChange(e.target.value)}
        className="max-w-xs"
      />
    </div>
  );
};
