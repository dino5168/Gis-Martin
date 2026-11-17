import { isThemeId, THEMES, type ThemeId } from '../map/style';

interface StyleSwitcherProps {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
}

/**
 * Drop-down list that switches the map colour theme.
 *
 * A native `<select>` keeps keyboard and screen-reader support for free and
 * scales to any number of themes, unlike a segmented control.
 *
 * Args:
 *   props: Current theme and the change handler.
 *
 * Returns:
 *   The map style panel.
 */
export function StyleSwitcher({ theme, onChange }: StyleSwitcherProps) {
  return (
    <section className="panel view-mode">
      <label className="style-select">
        <span>地圖樣式</span>
        <select
          value={theme}
          onChange={(e) => {
            // DOM 值是字串；只接受 THEMES 內的 id
            if (isThemeId(e.target.value)) onChange(e.target.value);
          }}
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
