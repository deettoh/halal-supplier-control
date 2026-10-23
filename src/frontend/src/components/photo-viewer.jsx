import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { ExternalLink, X } from "lucide-react";
import { useSession } from "../lib/session.jsx";
import { ErrorMessage } from "./request-state.jsx";
export function useObjectUrl(blob) {
  const [asset, setAsset] = useState({ blob: null, url: null });
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    // This state synchronises a browser resource, revoked on replacement/unmount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAsset({ blob, url: next });
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return blob && asset.blob === blob ? asset.url : null;
}
export function PhotoViewer({
  reference,
  file,
  alt = "Original delivery label photo",
  title = "Delivery label photo",
}) {
  const session = useSession();
  const query = useQuery({
    queryKey: [...session.key, "image", reference],
    queryFn: ({ signal }) =>
      session.gateway.readImage({ ...session.identity }, reference, { signal }),
    enabled: !file && !!reference,
  });
  const objectUrl = useObjectUrl(file || query.data);
  const source =
    session.gateway.mode === "preview" &&
    reference === "/media/label-alt-brand.jpg"
      ? reference
      : objectUrl;
  return (
    <figure className="evidence-photo">
      {source ? (
        <DialogTrigger>
          <img src={source} alt={alt} />
          <Button className="button open-photo">
            <ExternalLink size={16} aria-hidden="true" />
            Open photo
          </Button>
          <ModalOverlay className="modal-overlay" isDismissable>
            <Modal className="photo-modal">
              <Dialog>
                {({ close }) => (
                  <>
                    <header>
                      <Heading slot="title">{title}</Heading>
                      <Button className="button quiet" onPress={close}>
                        <X size={18} aria-hidden="true" />
                        Close photo
                      </Button>
                    </header>
                    <img src={source} alt={alt} />
                  </>
                )}
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      ) : query.error ? (
        <ErrorMessage error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <p role="status">Loading photo…</p>
      )}
    </figure>
  );
}
