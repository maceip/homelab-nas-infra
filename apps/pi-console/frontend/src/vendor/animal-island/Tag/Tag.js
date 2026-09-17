// Generated from the pinned Animal Island source. Do not edit.
import React, { useCallback } from 'react';
import classNames from 'classnames';
import styles from './tag.module.css';
const SIZE_CLASS = {
  small: styles['size-small'],
  medium: styles['size-medium'],
  large: styles['size-large']
};
const VARIANT_CLASS = {
  solid: styles['variant-solid'],
  outlined: styles['variant-outlined'],
  dashed: styles['variant-dashed'],
  soft: styles['variant-soft']
};
const COLOR_CLASS = (color, variant) => {
  if (color === 'default') return '';
  if (variant === 'solid') return styles[`color-${color}-solid`] || styles[`color-${color}`];
  return styles[`color-${color}-${variant}`] || styles[`color-${color}`];
};
export const Tag = ({
  children,
  size = 'medium',
  variant = 'soft',
  color = 'default',
  closable = false,
  onClose,
  onClick,
  disabled = false,
  className,
  style
}) => {
  const handleClose = useCallback(e => {
    e.stopPropagation();
    if (disabled) return;
    onClose?.(e);
  }, [disabled, onClose]);
  const handleClick = useCallback(e => {
    if (disabled) return;
    onClick?.(e);
  }, [disabled, onClick]);
  const isInteractive = !!onClick && !disabled;
  const cls = classNames(styles.tag, SIZE_CLASS[size], VARIANT_CLASS[variant], COLOR_CLASS(color, variant), disabled && styles['is-disabled'], isInteractive && styles['is-clickable'], className);
  const TagBody = <>
            <span className={styles.text}>{children}</span>
            {closable && <button type="button" className={styles.close} aria-label="close" onClick={handleClose} disabled={disabled}>
                    ×
                </button>}
        </>;
  if (isInteractive) {
    return <span className={cls} style={style} onClick={handleClick} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e);
      }
    }}>
                {TagBody}
            </span>;
  }
  return <span className={cls} style={style}>
            {TagBody}
        </span>;
};
Tag.displayName = 'Tag';
