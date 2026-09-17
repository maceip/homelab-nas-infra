// Generated from the pinned Animal Island source. Do not edit.
import React from 'react';
import styles from './card.module.css';
export const Card = ({
  type = 'default',
  color = 'default',
  pattern = 'none',
  hoverable = false,
  children,
  className,
  style,
  ...rest
}) => {
  const cls = [styles.card, type === 'dashed' && styles['card-dashed'], color !== 'default' && styles[`card-${color}`], pattern !== 'none' && styles[`pattern-${pattern}`], hoverable && styles['card-hoverable'], className].filter(Boolean).join(' ');
  return <div className={cls} style={style} {...rest}>
            {children}
        </div>;
};
Card.displayName = 'Card';
