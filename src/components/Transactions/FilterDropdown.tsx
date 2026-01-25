import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  onClear?: () => void;
}

export function FilterDropdown({ label, options, selectedValues, onChange, onClear }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleClear = () => {
    onChange([]);
    if (onClear) onClear();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 sm:h-8 shrink-0 items-center justify-center gap-x-1 sm:gap-x-2 rounded-lg bg-surface border border-border pl-2 sm:pl-3 pr-1 sm:pr-2 text-text-main hover:bg-primary/10 transition shadow-sm"
      >
        <p className="text-xs sm:text-sm font-medium whitespace-nowrap">{label}</p>
        {selectedValues.length > 0 && (
          <span className="flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-fg text-xs font-bold">
            {selectedValues.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-[50] min-w-[200px] bg-surface border border-border rounded-lg shadow-2xl">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-primary">Filtrar por {label}</span>
            {selectedValues.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 transition"
              >
                <X className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted text-center">
                No hay opciones disponibles
              </div>
            ) : (
              options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-surface/50 rounded cursor-pointer text-sm transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="text-text-main">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
