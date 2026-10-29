'use client';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState, KeyboardEvent } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  /** Rich label (may include text + markup). */
  label: React.ReactNode;
  /** Plain-text label for the trigger when `label` isn't a string, and for search. */
  text?: string;
  /** Optional leading visual (icon, coin logo…). */
  icon?: React.ReactNode;
  /** Optional trailing content shown only in the dropdown option (e.g. a balance). */
  meta?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Show a filter input at the top of the dropdown. */
  searchable?: boolean;
  searchPlaceholder?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

const ChevronDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-9" />
  </svg>
);

function nextEnabled(options: SelectOption[], from: number, dir: 1 | -1): number {
  const n = options.length;
  if (n === 0) return -1;
  for (let step = 1; step <= n; step++) {
    const i = (from + dir * step + n * step) % n;
    if (!options[i]?.disabled) return i;
  }
  return from;
}

const optionText = (o: SelectOption) => o.text ?? (typeof o.label === 'string' ? o.label : '');

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccioná una opción',
  id,
  disabled,
  className,
  searchable = false,
  searchPlaceholder,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}) => {
  const baseId = useId();
  const listId = `${id ?? baseId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => optionText(o).toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const [activeIndex, setActiveIndex] = useState(0);

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    setQuery('');
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const openPanel = useCallback(() => {
    if (disabled) return;
    setQuery('');
    const activeInFull = filtered.findIndex((o) => o.value === value);
    setActiveIndex(activeInFull >= 0 ? activeInFull : nextEnabled(filtered, -1, 1));
    setOpen(true);
  }, [disabled, filtered, value]);

  const choose = useCallback(
    (index: number) => {
      const opt = filtered[index];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
      close(true);
    },
    [filtered, onChange, close],
  );

  // Focus the search input (if any) or the listbox when opened.
  useEffect(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPanel();
    }
  };

  // Shared navigation for both the listbox and the search input.
  const onNavKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => nextEnabled(filtered, i, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => nextEnabled(filtered, i, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(nextEnabled(filtered, -1, 1));
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(nextEnabled(filtered, 0, -1));
        break;
      case 'Enter':
        e.preventDefault();
        choose(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActiveIndex(0);
  };

  const triggerText = selected ? (selected.text ?? (typeof selected.label === 'string' ? selected.label : undefined)) : undefined;

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={[styles.trigger, open && styles.triggerOpen].filter(Boolean).join(' ')}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        title={triggerText}
      >
        <span className={styles.value}>
          {selected?.icon}
          <span className={[styles.valueText, !selected && styles.placeholder].filter(Boolean).join(' ')}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <span className={[styles.chevron, open && styles.chevronOpen].filter(Boolean).join(' ')}>
          <ChevronDown />
        </span>
      </button>

      {open && (
        <div className={styles.panel}>
          {searchable && (
            <input
              ref={searchRef}
              type="text"
              className={styles.search}
              value={query}
              placeholder={searchPlaceholder ?? 'Buscar…'}
              onChange={onSearchChange}
              onKeyDown={onNavKeyDown}
              aria-label={searchPlaceholder ?? ariaLabel}
              aria-controls={listId}
              aria-activedescendant={filtered[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
            />
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={searchable ? -1 : 0}
            className={styles.list}
            aria-activedescendant={filtered[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            onKeyDown={searchable ? undefined : onNavKeyDown}
          >
            {filtered.length === 0 ? (
              <li className={styles.noResults} role="presentation">—</li>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={opt.value}
                    id={`${listId}-opt-${i}`}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    className={[
                      styles.option,
                      isActive && styles.optionActive,
                      isSelected && styles.optionSelected,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => choose(i)}
                    onMouseEnter={() => !opt.disabled && setActiveIndex(i)}
                  >
                    {opt.icon}
                    <span className={styles.optionLabel}>{opt.label}</span>
                    {opt.meta != null && <span className={styles.optionMeta}>{opt.meta}</span>}
                    {isSelected && <span className={styles.check}><Check /></span>}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
