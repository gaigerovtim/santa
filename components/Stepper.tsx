interface StepperProps {
  steps: readonly string[];
  current: number; // с нуля
}

/** Индикатор шагов формы. */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Шаги оформления">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold ${
                state === "todo" ? "border border-line text-muted" : "bg-garland text-night"
              }`}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span className={`text-sm ${state === "current" ? "font-semibold text-text" : "text-muted"}`}>
              {label}
              <span className="sr-only">
                {state === "done" ? " — готово" : state === "current" ? " — текущий шаг" : ""}
              </span>
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
