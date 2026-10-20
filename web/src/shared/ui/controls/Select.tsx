'use client';
import React, { useCallback, useEffect, useId, useRef, useState, KeyboardEvent } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  /** Rich label (may include text + markup). */
  label: React.ReactNode;
  /** Plain-text label for the trigger when `label` isn't a string. */
  text?: string;
  /** Optional leading visual (icon, coin logo…). */
  icon?: React.ReactNode;
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
  for (let step = 1; step <= n; step++) {
    const i = (from + dir * step + n * step) % n;
    if (!options[i]?.disabled) return i;
  }
  return from;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccioná una opción',
  id,
  disabled,
  className,
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
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const openPanel = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : nextEnabled(options, -1, 1));
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  const choose = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
      close(true);
    },
    [options, onChange, close]
  );

  // Focus the listbox and scroll the active option into view when opened.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPanel();
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => nextEnabled(options, i, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => nextEnabled(options, i, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(nextEnabled(options, -1, 1));
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(nextEnabled(options, 0, -1));
        break;
      case 'Enter':
      case ' ':
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
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className={styles.panel}
          aria-activedescendant={`${listId}-opt-${activeIndex}`}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          onKeyDown={onListKeyDown}
        >
          {options.map((opt, i) => {
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
                {isSelected && <span className={styles.check}><Check /></span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
