"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { Button } from "@/components/ui/button";

export function DeleteCustomerButton({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not delete");
        return;
      }
      toast.success("Customer deleted");
      setOpen(false);
      router.push("/admin/customers");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete customer?"
        description={`This permanently removes ${email} from the hub, including their payments and licenses. It does not refund in Paddle.`}
        confirmLabel="Delete customer"
        loading={loading}
        onConfirm={onConfirm}
      />
    </>
  );
}
