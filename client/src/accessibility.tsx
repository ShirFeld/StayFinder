import React, { useEffect, useId, useRef } from "react";
import { useLocation } from "react-router-dom";

export function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    let observer: MutationObserver | undefined;
    const focus = () => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return false;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      document.title = heading.textContent + " | StayFinder";
      observer?.disconnect();
      return true;
    };
    window.scrollTo(0, 0);
    if (!focus()) {
      observer = new MutationObserver(focus);
      observer.observe(document.getElementById("main-content")!, {
        childList: true,
        subtree: true,
      });
    }
    return () => observer?.disconnect();
  }, [pathname]);
  return null;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!,
      previous = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div id={descriptionId}>{children}</div>
      <div className="dialog-actions">
        <button
          type="button"
          className="outline"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          Keep booking
        </button>
        <button type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Cancelling..." : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
