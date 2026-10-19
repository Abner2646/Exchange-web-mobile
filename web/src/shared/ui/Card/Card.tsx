'use client';
import React, { forwardRef, HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `quiet` recedes with a softer border. */
  variant?: 'default' | 'quiet';
  /** Larger internal padding. */
  padding?: 'md' | 'lg';
  /** Adds a hover lift — only for cards that are a real link/button. */
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', interactive = false, className, children, ...props }, ref) => {
    const classNames = [
      styles.card,
      variant === 'quiet' && styles.quiet,
      padding === 'lg' && styles['pad-lg'],
      interactive && styles.interactive,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classNames} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
