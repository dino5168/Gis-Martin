import { THEMES, type ThemeId } from '../map/style';

interface StyleSwitcherProps {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
}

/**
 * Segmented control that switches the map colour theme.
 *
 * Args:
 *   props: Current theme and the change handler.
 *
 * Returns:
 *   The map style panel.
 */
export function StyleSwitcher({ theme, onChange }: StyleSwitcherProps) {
  return (
    <section className="panel view-mode" aria-label="地圖樣式">
      <h2>地圖樣式</h2>
      <div className="segmented" role="radiogroup" aria-label="地圖樣式">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            className={theme === t.id ? 'active' : ''}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
