import React, { useId, ReactElement, cloneElement, InputHTMLAttributes } from 'react';
import styles from './Field.module.css';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helpText?: string;
  error?: string;
  children?: ReactElement;
}

export const Field: React.FC<FieldProps> = ({
  label,
  helpText,
  error,
  children,
  id: providedId,
  className,
  ...props
}) => {
  const generatedId = useId();
  
  let controlId = providedId || generatedId;
  if (children && children.props.id) {
    controlId = children.props.id;
  }

  const helpTextId = `${controlId}-help`;
  const errorId = `${controlId}-error`;

  const ariaDescribedBy = [
    error ? errorId : null,
    helpText ? helpTextId : null
  ].filter(Boolean).join(' ') || undefined;

  const isInvalid = !!error;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
      </label>
      
      {children ? (
        cloneElement(children, {
          ...children.props,
          id: controlId,
          'aria-invalid': children.props['aria-invalid'] ?? isInvalid,
          'aria-describedby': [children.props['aria-describedby'], ariaDescribedBy].filter(Boolean).join(' ') || undefined
        })
      ) : (
        <input
          type="text"
          className={[styles.input, isInvalid && styles.inputError].filter(Boolean).join(' ')}
          {...props}
          id={controlId}
          aria-invalid={isInvalid}
          aria-describedby={ariaDescribedBy}
        />
      )}

      {error && (
        <span id={errorId} className={styles.errorText}>
          {error}
        </span>
      )}
      {helpText && (
        <span id={helpTextId} className={styles.helpText}>
          {helpText}
        </span>
      )}
    </div>
  );
};
