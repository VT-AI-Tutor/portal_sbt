import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/core/ui/alert-dialog";
import { buttonVariants } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { cn } from "@/core/lib/utils";

type ConfirmOptions = {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Style nút xác nhận theo hành động phá huỷ (đỏ). */
  destructive?: boolean;
};

type PromptOptions = {
  title: React.ReactNode;
  description?: React.ReactNode;
  label?: React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

type ConfirmState = ConfirmOptions & {
  kind: "confirm";
  resolve: (value: boolean) => void;
};

type PromptState = PromptOptions & {
  kind: "prompt";
  resolve: (value: string | null) => void;
};

type DialogState = ConfirmState | PromptState;

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DialogState | null>(null);
  const [value, setValue] = React.useState("");

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ kind: "confirm", resolve, ...options });
      }),
    [],
  );

  const prompt = React.useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(options.defaultValue ?? "");
        setState({ kind: "prompt", resolve, ...options });
      }),
    [],
  );

  const contextValue = React.useMemo(
    () => ({ confirm, prompt }),
    [confirm, prompt],
  );

  const close = (result: boolean | string | null) => {
    if (!state) return;
    if (state.kind === "prompt") {
      state.resolve(result as string | null);
    } else {
      state.resolve(result as boolean);
    }
    setState(null);
  };

  const handleConfirm = () => {
    if (!state) return;
    close(state.kind === "prompt" ? value : true);
  };

  const handleCancel = () => {
    close(state?.kind === "prompt" ? null : false);
  };

  const destructive = state?.kind === "confirm" && state.destructive;

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      <AlertDialog
        open={state !== null}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        {state && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{state.title}</AlertDialogTitle>
              {state.description && (
                <AlertDialogDescription>
                  {state.description}
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>
            {state.kind === "prompt" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirm();
                }}
                className="space-y-2"
              >
                {state.label && <Label htmlFor="confirm-prompt-input">{state.label}</Label>}
                <Input
                  id="confirm-prompt-input"
                  autoFocus
                  value={value}
                  placeholder={state.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                />
              </form>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancel}>
                {state.cancelText ?? "Huỷ"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                className={cn(
                  destructive &&
                    buttonVariants({ variant: "destructive" }),
                )}
              >
                {state.confirmText ?? "Xác nhận"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

function useConfirmContext() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm/usePrompt phải nằm trong <ConfirmProvider>");
  }
  return ctx;
}

/** Hộp thoại xác nhận (thay cho window.confirm). Trả về Promise<boolean>. */
export function useConfirm() {
  return useConfirmContext().confirm;
}

/** Hộp thoại nhập liệu (thay cho window.prompt). Trả về Promise<string | null>. */
export function usePrompt() {
  return useConfirmContext().prompt;
}
