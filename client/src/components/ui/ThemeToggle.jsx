import { BsMoonStars, BsSun } from 'react-icons/bs';
import { useTheme } from '../../contexts/theme';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className="icon-button" onClick={toggleTheme} aria-label={label} title={label}>
      {isDark ? <BsSun aria-hidden="true" /> : <BsMoonStars aria-hidden="true" />}
    </button>
  );
}
