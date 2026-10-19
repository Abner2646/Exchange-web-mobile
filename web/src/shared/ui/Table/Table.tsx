'use client';
import React, { TableHTMLAttributes } from 'react';
import styles from './Table.module.css';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Wrapper element props (e.g. className for width constraints). */
  wrapClassName?: string;
}

export const Table: React.FC<TableProps> = ({ wrapClassName, className, children, ...props }) => (
  <div className={[styles.wrap, wrapClassName].filter(Boolean).join(' ')}>
    <table className={[styles.table, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </table>
  </div>
);
