import React from "react";
import { clsx } from "clsx";

export interface AlertProps {
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  actions?: Array<{
    label: string;
    onClick: () => void | Promise<void>;
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
  }>;
  onClose?: () => void;
  dismissible?: boolean;
}

export function Alert({
  title,
  message,
  type,
  actions,
  onClose,
  dismissible = true,
}: AlertProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const typeStyles = {
    success: {
      bg: "bg-emerald-950/20",
      border: "border-emerald-600/30",
      icon: "text-emerald-400",
      title: "text-emerald-300",
    },
    error: {
      bg: "bg-red-950/20",
      border: "border-red-600/30",
      icon: "text-red-400",
      title: "text-red-300",
    },
    warning: {
      bg: "bg-amber-950/20",
      border: "border-amber-600/30",
      icon: "text-amber-400",
      title: "text-amber-300",
    },
    info: {
      bg: "bg-blue-950/20",
      border: "border-blue-600/30",
      icon: "text-blue-400",
      title: "text-blue-300",
    },
  };

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ⓘ",
  };

  const style = typeStyles[type];

  const handleActionClick = async (action: NonNullable<AlertProps["actions"]>[number]) => {
    setIsLoading(true);
    try {
      await action.onClick();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={clsx(
        "rounded-lg border p-4 backdrop-blur-sm",
        style.bg,
        style.border
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <div className={clsx("text-lg font-bold", style.icon)}>
          {icons[type]}
        </div>
        <div className="flex-1">
          <h3 className={clsx("font-semibold", style.title)}>{title}</h3>
          <p className="text-sm text-white/70 mt-1">{message}</p>

          {actions && actions.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleActionClick(action)}
                  disabled={action.disabled || isLoading}
                  className={clsx(
                    "px-3 py-1 rounded text-sm font-medium transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    {
                      "bg-emerald-600 hover:bg-emerald-700 text-white":
                        action.variant === "primary" || !action.variant,
                      "bg-white/10 hover:bg-white/20 text-white/90":
                        action.variant === "secondary",
                      "bg-red-600 hover:bg-red-700 text-white":
                        action.variant === "danger",
                    }
                  )}
                >
                  {isLoading && (
                    <span className="inline-block mr-1 animate-spin">⏳</span>
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {dismissible && onClose && (
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/80 transition-colors flex-shrink-0"
            aria-label="Close alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export interface AlertContainerProps {
  alerts: Array<AlertProps & { id: string }>;
  onRemove: (id: string) => void;
}

export function AlertContainer({ alerts, onRemove }: AlertContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 space-y-3 max-w-md z-50">
      {alerts.map((alert) => (
        <Alert
          key={alert.id}
          {...alert}
          onClose={() => onRemove(alert.id)}
        />
      ))}
    </div>
  );
}
