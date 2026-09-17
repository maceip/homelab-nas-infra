// Generated from the pinned Animal Island source. Do not edit.
import React, { useMemo } from 'react';
import classNames from 'classnames';
import styles from './progress.module.css';
const SIZE_CLASS = {
  small: styles['size-small'],
  middle: styles['size-middle'],
  large: styles['size-large']
};
const INSIDE_MIN_FILL = 18;
export const Progress = ({
  percent,
  size = 'middle',
  showInfo = true,
  infoPosition = 'inside',
  infoFormat,
  duration = 0.6,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy
}) => {
  const safePercent = useMemo(() => {
    if (typeof percent !== 'number' || Number.isNaN(percent)) return 0;
    return Math.max(0, Math.min(100, percent));
  }, [percent]);
  const renderedInfo = useMemo(() => {
    if (infoFormat) return infoFormat(safePercent);
    return `${Math.round(safePercent)}%`;
  }, [infoFormat, safePercent]);
  const inlineFillStyle = {
    width: `${safePercent}%`,
    transitionDuration: `${duration}s`
  };
  const isInside = showInfo && infoPosition === 'inside';
  const infoInsideVisible = isInside && safePercent >= INSIDE_MIN_FILL;
  const cls = classNames(styles.progress, className);
  const trackCls = classNames(styles.track, SIZE_CLASS[size]);
  const fillCls = classNames(styles.fill, duration === 0 && styles.noTransition);
  const bodyCls = classNames(styles.body, infoPosition === 'top' ? '' : styles.noGap);
  const ariaValueText = typeof renderedInfo === 'string' ? renderedInfo : undefined;
  return <div className={cls} style={style} role="progressbar" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safePercent)} aria-valuetext={ariaValueText}>
            {infoPosition === 'top' ? <div className={bodyCls}>
                    {showInfo && <div className={classNames(styles.info, styles.top)}>{renderedInfo}</div>}
                    <div className={trackCls}>
                        <div className={fillCls} style={inlineFillStyle}>
                            {infoInsideVisible && <span className={styles.infoInside}>{renderedInfo}</span>}
                        </div>
                        {isInside && !infoInsideVisible && <span className={styles.infoInside} style={{
          color: '#725d42'
        }}>
                                {renderedInfo}
                            </span>}
                    </div>
                </div> : <div className={styles.row}>
                    <div className={trackCls}>
                        <div className={fillCls} style={inlineFillStyle}>
                            {infoInsideVisible && <span className={styles.infoInside}>{renderedInfo}</span>}
                        </div>
                        {isInside && !infoInsideVisible && <span className={styles.infoInside} style={{
          color: '#725d42'
        }}>
                                {renderedInfo}
                            </span>}
                    </div>
                    {showInfo && infoPosition === 'right' && <div className={classNames(styles.info, styles.right)}>{renderedInfo}</div>}
                </div>}
        </div>;
};
Progress.displayName = 'Progress';
