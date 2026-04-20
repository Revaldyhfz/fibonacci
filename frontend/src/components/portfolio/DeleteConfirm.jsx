import Modal from "../ui/Modal";
import Button from "../ui/Button";

/**
 * DeleteConfirm — generic confirm dialog on Modal primitive.
 *
 * Props:
 *   open         boolean
 *   onCancel     () => void
 *   onConfirm    () => void | Promise<void>
 *   title        string                (default: "Remove asset?")
 *   message      string|ReactNode      (default: friendly copy)
 *   confirmLabel string                (default: "Remove")
 *   loading      boolean
 */
export default function DeleteConfirm({
  open,
  onCancel,
  onConfirm,
  title = "Remove asset?",
  message = "This permanently removes the asset from your portfolio. This action cannot be undone.",
  confirmLabel = "Remove",
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-300">{message}</p>
    </Modal>
  );
}
