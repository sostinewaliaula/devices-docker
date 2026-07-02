import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SunIcon, MoonIcon, MonitorIcon } from 'lucide-react';

const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const options = [
        { id: 'light', icon: SunIcon, label: 'Light' },
        { id: 'system', icon: MonitorIcon, label: 'System' },
        { id: 'dark', icon: MoonIcon, label: 'Dark' },
    ] as const;

    return (
        <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 select-none">
            {options.map(({ id, icon: Icon, label }) => {
                const isActive = theme === id;
                return (
                    <button
                        key={id}
                        onClick={() => setTheme(id)}
                        className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200
              ${isActive
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-primary dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }
            `}
                    >
                        <Icon className="w-4 h-4" />
                        {isActive && <span className="text-xs font-medium">{label}</span>}
                    </button>
                );
            })}
        </div>
    );
};

export default ThemeToggle;
