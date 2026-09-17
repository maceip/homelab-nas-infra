// Generated from the pinned Animal Island source. Do not edit.
import React from 'react';
import styles from './button.module.css';
export const Button = ({
  type = 'default',
  size = 'middle',
  danger = false,
  ghost = false,
  block = false,
  loading = false,
  disabled = false,
  icon,
  htmlType = 'button',
  children,
  className,
  ...rest
}) => {
  const classNames = [styles.btn, styles[`btn-${type}`], styles[`btn-${size}`], danger && styles['btn-danger'], ghost && styles['btn-ghost'], block && styles['btn-block'], loading && styles['btn-loading'], className].filter(Boolean).join(' ');
  return <button type={htmlType} className={classNames} disabled={disabled} {...rest}>
            {icon && !loading && <span className={styles['btn-icon']}>{icon}</span>}
            {children && <span>{children}</span>}
        </button>;
};
Button.displayName = 'Button';
