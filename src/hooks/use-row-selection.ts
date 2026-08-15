"use client";

import { useCallback, useState } from "react";

export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectedIds = ids.filter((id) => selected.has(id));
  const allSelected = ids.length > 0 && selectedIds.length === ids.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggle = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (checked) {
          for (const id of ids) next.add(id);
        } else {
          for (const id of ids) next.delete(id);
        }
        return next;
      });
    },
    [ids],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return {
    selectedIds,
    allSelected,
    someSelected,
    isSelected,
    toggle,
    toggleAll,
    clear,
    count: selectedIds.length,
  };
}
