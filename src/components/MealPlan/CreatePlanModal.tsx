import { useMemo, useState } from "react";
import type { CreatePlanValues, MealType, Weekday } from "../../types/mealPlan";

export type { CreatePlanValues } from "../../types/mealPlan";

type CreatePlanModalProps = {
  open: boolean;
  title: string;
  initialBudget: number;
  onClose: () => void;
  onCreate: (values: CreatePlanValues) => void;
};

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES: Array<{ key: MealType; label: string }> = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

function fmtCop(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function defaultSelections(): CreatePlanValues["selections"] {
  const base: CreatePlanValues["selections"] = {
    Mon: { breakfast: false, lunch: false, dinner: true },
    Tue: { breakfast: false, lunch: false, dinner: true },
    Wed: { breakfast: false, lunch: false, dinner: true },
    Thu: { breakfast: false, lunch: false, dinner: true },
    Fri: { breakfast: false, lunch: false, dinner: true },
    Sat: { breakfast: false, lunch: false, dinner: false },
    Sun: { breakfast: false, lunch: false, dinner: false },
  };
  return base;
}

export default function CreatePlanModal(props: CreatePlanModalProps) {
  const [budget, setBudget] = useState(props.initialBudget);
  const [onlySavedRecipes, setOnlySavedRecipes] = useState(false);
  const [onlyNewRecipes, setOnlyNewRecipes] = useState(false);
  const [selections, setSelections] = useState<CreatePlanValues["selections"]>(() => defaultSelections());

  const selectedCount = useMemo(() => {
    let c = 0;
    for (const d of WEEKDAYS) for (const m of MEAL_TYPES) if (selections[d][m.key]) c++;
    return c;
  }, [selections]);

  if (!props.open) return null;

  const canCreate = selectedCount > 0 && budget > 0;

  return (
    <div className="mp-modalOverlay" role="dialog" aria-modal="true" aria-label="Create week plan">
      <div className="mp-modal">
        <button type="button" className="mp-modalClose" onClick={props.onClose} aria-label="Close">
          ×
        </button>

        <div className="mp-modalTitle">{props.title}</div>

        <div className="mp-modalSection">
          <div className="mp-modalSectionTitle">Budget</div>
          <input
            className="mp-slider"
            type="range"
            min={50000}
            max={500000}
            step={5000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <div className="mp-modalValue">${fmtCop(budget)}</div>
        </div>

        <div className="mp-modalSection">
          <div className="mp-modalSectionTitle">Preferences</div>
          <div className="mp-modalPrefs">
            <label className="mp-checkboxRow">
              <input
                type="checkbox"
                checked={onlySavedRecipes}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOnlySavedRecipes(next);
                  if (next) setOnlyNewRecipes(false);
                }}
              />
              <span>Only saved recipes</span>
            </label>
            <label className="mp-checkboxRow">
              <input
                type="checkbox"
                checked={onlyNewRecipes}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOnlyNewRecipes(next);
                  if (next) setOnlySavedRecipes(false);
                }}
              />
              <span>Try new recipes</span>
            </label>
          </div>
          <div className="mp-modalHint">{!onlySavedRecipes && !onlyNewRecipes ? "Random mix" : null}</div>
        </div>

        <div className="mp-modalSection">
          <div className="mp-modalSectionTitle">Days you want to cook</div>
          <div className="mp-dayGrid">
            <div className="mp-dayGridHead" />
            {MEAL_TYPES.map((m) => (
              <div key={m.key} className="mp-dayGridHead">
                {m.label}
              </div>
            ))}
            {WEEKDAYS.map((d) => (
              <div key={d} className="mp-dayRow">
                <div className="mp-dayCell mp-dayLabel">{d}</div>
                {MEAL_TYPES.map((m) => (
                  <label key={`${d}-${m.key}`} className="mp-dayCell mp-dayCheck">
                    <input
                      type="checkbox"
                      checked={selections[d][m.key]}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelections((prev) => ({
                          ...prev,
                          [d]: { ...prev[d], [m.key]: checked },
                        }));
                      }}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="mp-primaryBtn"
          disabled={!canCreate}
          onClick={() => props.onCreate({ budget, onlySavedRecipes, onlyNewRecipes, selections })}
        >
          Create week plan
        </button>
      </div>
    </div>
  );
}
