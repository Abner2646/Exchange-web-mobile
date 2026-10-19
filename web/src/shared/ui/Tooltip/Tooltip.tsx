'use client';
import React, { useId, ReactElement, cloneElement } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: React.ReactNode;
  /** The trigger — a single focusable element (button, link, input…). */
  children: ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const id = useId();

  const trigger = cloneElement(children, {
    'aria-describedby': [children.props['aria-describedby'], id].filter(Boolean).join(' '),
  });

  return (
    <span className={styles.wrap}>
      {trigger}
      <span role="tooltip" id={id} className={styles.bubble}>
        {content}
      </span>
    </span>
  );
};
